'use strict';

/**
 * MIDDLEWARE DE AUTENTICAÇÃO UNIFICADO — auth.middleware.js
 *
 * PROBLEMA ANTERIOR:
 * O projeto tinha dois middlewares de autenticação JWT:
 *
 *   1. auth.js (legado)
 *      - Usa process.env.JWT_SECRET diretamente (sem validação)
 *      - Não consulta o banco para confirmar se o usuário existe
 *      - Payload { id, role } (formato antigo)
 *      - Responde com res.json() — não usa next(error)
 *
 *   2. authMiddleware.js (moderno)
 *      - Usa env.JWT_SECRET (validado pela startup)
 *      - Consulta o banco para confirmar que o funcionário existe e está ativo
 *      - Payload { sub, role } (formato JWT padrão)
 *      - Usa next(error) — compatível com errorMiddleware
 *
 * SOLUÇÃO:
 * Este arquivo consolida as melhores práticas em funções nomeadas.
 * O auth.js legado foi mantido para não quebrar importações existentes,
 * mas agora aponta para env.JWT_SECRET.
 *
 * NOVO PADRÃO:
 * Use authenticateFuncionario para rotas de funcionário (já era o padrão).
 * Use ensureAdminApiAuthenticated para rotas de admin (Gov.br session).
 *
 * Use requireRole() de role.middleware.js para verificar o role depois.
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { executeOne } = require('../config/database');
const { ForbiddenError, UnauthorizedError } = require('../utils/errors');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extrai o Bearer token do header Authorization.
 * Retorna null se não houver header ou formato inválido.
 *
 * Formato esperado: Authorization: Bearer <token>
 */
function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== 'string') return null;

  const [scheme, token] = authHeader.split(' ');
  if (!/^Bearer$/i.test(scheme) || !token) return null;

  return token.trim();
}

// ─── authenticateFuncionario ─────────────────────────────────────────────────

/**
 * Middleware de autenticação para funcionários.
 *
 * O que faz:
 * 1. Extrai o JWT do header Authorization: Bearer <token>
 * 2. Verifica a assinatura e expiração com env.JWT_SECRET (validado)
 * 3. Confirma que o role é 'funcionario'
 * 4. Consulta o banco para confirmar que o funcionário existe e está ativo
 * 5. Popula req.auth com os dados do funcionário
 *
 * Por que consultar o banco?
 * Um token JWT válido não garante que o usuário ainda existe ou está ativo.
 * Se um funcionário for desativado, o token dele (dentro do período de validade)
 * ainda seria aceito sem essa consulta.
 *
 * @type {import('express').RequestHandler}
 */
async function authenticateFuncionario(req, _res, next) {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      throw new UnauthorizedError('Sessão do funcionário é obrigatória — faça login');
    }

    // jwt.verify lança JsonWebTokenError se a assinatura for inválida,
    // TokenExpiredError se o token tiver expirado, ou NotBeforeError se nbf falhar.
    const payload = jwt.verify(token, env.JWT_SECRET);
    const role = String(payload.role || '').toLowerCase();

    if (role !== 'funcionario') {
      throw new ForbiddenError('Esta rota é exclusiva para funcionários');
    }

    // Suporte a tokens com payload.sub (novo padrão) ou payload.id (legado)
    const funcionarioId = Number(payload.sub || payload.id || 0);
    if (!Number.isInteger(funcionarioId) || funcionarioId <= 0) {
      throw new UnauthorizedError('Token de sessão inválido');
    }

    // Consulta o banco para confirmar existência e status ativo
    const funcionario = await executeOne(
      'SELECT id, cpf, nome, email, ativo FROM funcionarios WHERE id = ? LIMIT 1',
      [funcionarioId]
    );

    if (!funcionario || !funcionario.ativo) {
      throw new UnauthorizedError('Funcionário inexistente ou inativo');
    }

    // Popula req.auth para uso nos controllers e no roleMiddleware
    req.auth = {
      id: funcionario.id,
      nome: funcionario.nome,
      role: 'funcionario',
      email: funcionario.email,
      cpf: funcionario.cpf,
    };

    return next();
  } catch (error) {
    // Converte erros específicos do jwt para erros da aplicação
    if (error.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Sessão expirada — faça login novamente'));
    }
    if (error.name === 'JsonWebTokenError' || error.name === 'NotBeforeError') {
      return next(new UnauthorizedError('Token de sessão inválido'));
    }
    return next(error);
  }
}

// ─── verifyRole (compatibilidade com auth.js legado) ─────────────────────────

/**
 * Middleware de verificação de role por JWT.
 * NOTA: Este é o substituto seguro para auth.js::verifyRole().
 *
 * Diferença do authenticateFuncionario:
 * - Não consulta o banco (mais leve, mas não verifica se usuário está ativo)
 * - Suporta qualquer role via parâmetro
 * - Usado para rotas que não precisam de verificação de banco (ex: rotas legadas)
 *
 * Para novas rotas, prefira authenticateFuncionario (funcionário) ou
 * ensureAdminApiAuthenticated (admin).
 */
function verifyRole(expectedRole) {
  return (req, res, next) => {
    try {
      const token = extractBearerToken(req);

      if (!token) {
        return res.status(401).json({ message: 'Acesso não autorizado' });
      }

      // CORREÇÃO: usa env.JWT_SECRET (validado) em vez de process.env.JWT_SECRET direto
      const payload = jwt.verify(token, env.JWT_SECRET);

      if (payload.role !== expectedRole) {
        return res.status(403).json({ message: 'Acesso proibido para este perfil' });
      }

      // Suporte a payload.sub (novo) e payload.id (legado)
      req.user = {
        id: payload.sub || payload.id,
        role: payload.role,
      };

      req.auth = req.user;

      return next();
    } catch (_error) {
      return res.status(401).json({ message: 'Token inválido ou expirado' });
    }
  };
}

module.exports = {
  authenticateFuncionario,
  extractBearerToken,
  verifyRole,
  // Exporta atalhos com nomes amigáveis
  verifyAdmin: verifyRole('admin'),
  verifyFuncionario: verifyRole('funcionario'),
};
