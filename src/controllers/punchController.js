const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { executeOne, withTransaction } = require('../config/database');
const { isWithinRadius } = require('../utils/location');
const { maskCpf, normalizeCpf } = require('../utils/cpf');
const {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError
} = require('../utils/errors');
const { registerAuditLog } = require('../services/auditLogService');

const PUNCH_TYPES = ['ENTRADA', 'SAIDA_ALMOCO', 'VOLTA_ALMOCO', 'SAIDA'];

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')?.[0]?.trim() || req.ip || null;
}

function getClientUserAgent(req) {
  return String(req.headers['user-agent'] || '').slice(0, 255) || null;
}

function getSaoPauloDateTime(referenceDate = new Date()) {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(referenceDate);
  const map = {};
  parts.forEach((part) => {
    map[part.type] = part.value;
  });

  return {
    date: `${map.year}-${map.month}-${map.day}`,
    dateTime: `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`
  };
}

function validateLocation(latitude, longitude) {
  const distanceCheck = isWithinRadius(
    { latitude: env.SCHOOL_LATITUDE, longitude: env.SCHOOL_LONGITUDE },
    { latitude, longitude },
    env.ALLOWED_RADIUS_METERS
  );

  if (!distanceCheck.distanceMeters && distanceCheck.distanceMeters !== 0) {
    throw new BadRequestError('Localizacao invalida para registro de ponto');
  }

  if (!distanceCheck.isWithin) {
    throw new ForbiddenError('Voce so pode bater ponto dentro da area permitida da escola.');
  }

  return distanceCheck;
}

function mapFuncionario(funcionario) {
  return {
    id: funcionario.id,
    nome: funcionario.nome,
    email: funcionario.email,
    cpf: maskCpf(funcionario.cpf)
  };
}

async function loginFuncionario(req, res, next) {
  try {
    const rawLogin = String(req.body.login || req.body.email || req.body.cpf || '').trim();
    const cpf = normalizeCpf(rawLogin || req.body.cpf);
    const email = rawLogin.includes('@') ? rawLogin.toLowerCase() : '';
    const senha = String(req.body.senha || '');
    const ipOrigem = getClientIp(req);

    if (!rawLogin) {
      throw new BadRequestError('Informe CPF ou email');
    }

    const funcionario = await executeOne(
      `SELECT id, cpf, nome, email, senha_hash, ativo
       FROM funcionarios
       WHERE ${email ? 'email = ?' : 'cpf = ?'}
       LIMIT 1`,
      [email || cpf]
    );

    const senhaCorreta = funcionario ? await bcrypt.compare(senha, funcionario.senha_hash) : false;
    if (!funcionario || !senhaCorreta) {
      await registerAuditLog({
        evento: 'funcionario_login_invalido',
        nivel: 'WARN',
        mensagem: 'Tentativa de login de funcionario invalida',
        ipOrigem,
        metadados: { login: email || maskCpf(cpf) }
      });
      throw new UnauthorizedError('CPF/email ou senha invalidos');
    }

    if (!funcionario.ativo) {
      throw new ForbiddenError('Funcionario inativo');
    }

    const tokenPayload = {
      sub: String(funcionario.id),
      role: 'funcionario'
    };
    const token = jwt.sign(tokenPayload, env.JWT_SECRET, { expiresIn: env.FUNCIONARIO_JWT_EXPIRES_IN });

    await registerAuditLog({
      evento: 'funcionario_login_sucesso',
      funcionarioId: funcionario.id,
      mensagem: 'Login de funcionario realizado com CPF/email e senha',
      ipOrigem,
      metadados: { login: email || maskCpf(cpf) }
    });

    return res.status(200).json({
      success: true,
      data: {
        token,
        expiresIn: env.FUNCIONARIO_JWT_EXPIRES_IN,
        funcionario: mapFuncionario(funcionario)
      }
    });
  } catch (error) {
    return next(error);
  }
}

async function registerPunch(req, res, next) {
  try {
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);
    const ipOrigem = getClientIp(req);
    const userAgent = getClientUserAgent(req);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new BadRequestError('Localizacao invalida para registro de ponto');
    }

    const distanceCheck = validateLocation(latitude, longitude);
    const now = new Date();
    const { date, dateTime } = getSaoPauloDateTime(now);

    const punch = await withTransaction(async (tx) => {
      const funcionario = await tx.executeOne(
        `SELECT id, cpf, nome, email, ativo
         FROM funcionarios
         WHERE id = ?
         LIMIT 1
         FOR UPDATE`,
        [req.auth.id]
      );

      if (!funcionario) {
        throw new NotFoundError('Funcionario nao encontrado');
      }

      if (!funcionario.ativo) {
        throw new ForbiddenError('Funcionario inativo');
      }

      const countRow = await tx.executeOne(
        `SELECT COUNT(*) AS total
         FROM registro_de_pontos
         WHERE funcionario_id = ? AND data_referencia = ?
         FOR UPDATE`,
        [funcionario.id, date]
      );

      const totalPontos = Number(countRow?.total || 0);
      if (totalPontos >= 4) {
        throw new ConflictError('Funcionario ja realizou 4 batidas hoje');
      }

      const sequencia = totalPontos + 1;
      const tipo = PUNCH_TYPES[sequencia - 1];

      const insertResult = await tx.execute(
        `INSERT INTO registro_de_pontos
         (funcionario_id, data_referencia, sequencia, tipo, registrado_em, latitude, longitude, distancia_metros, ip_origem, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          funcionario.id,
          date,
          sequencia,
          tipo,
          dateTime,
          latitude,
          longitude,
          distanceCheck.distanceMeters,
          ipOrigem,
          userAgent
        ]
      );

      return {
        id: insertResult.insertId,
        funcionario,
        sequencia,
        tipo,
        registradoEm: dateTime,
        distanciaMetros: distanceCheck.distanceMeters
      };
    });

    await registerAuditLog({
      evento: 'batida_ponto_realizada',
      funcionarioId: punch.funcionario.id,
      mensagem: 'Batida de ponto registrada com sucesso',
      ipOrigem,
      metadados: {
        sequencia: punch.sequencia,
        tipo: punch.tipo,
        distancia_metros: punch.distanciaMetros
      }
    });

    return res.status(201).json({
      success: true,
      data: {
        ponto: {
          id: punch.id,
          sequencia: punch.sequencia,
          tipo: punch.tipo,
          registrado_em: punch.registradoEm,
          distancia_metros: punch.distanciaMetros
        },
        funcionario: mapFuncionario(punch.funcionario)
      }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return next(new ConflictError('Registro duplicado de ponto detectado'));
    }
    return next(error);
  }
}

module.exports = {
  loginFuncionario,
  registerPunch
};
