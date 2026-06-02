'use strict';

/**
 * CONTROLLER DE AUTENTICAÇÃO LEGADO — authController.js
 *
 * ATENÇÃO: Este arquivo é legado. As rotas que ele servia foram migradas para:
 *   - Admin:      adminAuthController.js (Gov.br OAuth via session)
 *   - Funcionário: punchController.js::loginFuncionario (via /ponto/login)
 *
 * CORREÇÕES APLICADAS:
 *
 * 1. PROBLEMA: Usava `pool` de `db.js` (módulo legado sem safeguards).
 *    SOLUÇÃO:   Agora usa `execute, executeOne` de `database.js` (módulo principal
 *               com assertSqlAndParams e normalizeError).
 *
 * 2. PROBLEMA: Usava `process.env.JWT_SECRET` diretamente — se o .env não
 *              carregar, o secret seria `undefined` e o JWT seria assinado com
 *              undefined, causando tokens inválidos sem erro na startup.
 *    SOLUÇÃO:   Agora usa `env.JWT_SECRET` — o módulo env.js valida o secret na
 *               startup (min 32 chars, entropia mista, sem valores fracos).
 *               Se o secret for inválido, a aplicação NÃO sobe.
 *
 * 3. PROBLEMA: `loginFuncionario` usava `SELECT * FROM login` separado do `funcionarios`.
 *    SOLUÇÃO:   Query consolidada, verificando ativo e usando senha do próprio funcionário.
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
// ✅ CORREÇÃO #1: substitui 'db.js' por 'database.js'
const { execute, executeOne } = require('../config/database');
// ✅ CORREÇÃO #2: substitui process.env.JWT_SECRET por env.JWT_SECRET
const env = require('../config/env');
const { buildAdminAuthCookie, buildClearAdminAuthCookie } = require('../utils/authCookie');

// ─── Helper: normaliza CPF ───────────────────────────────────────────────────

function normalizeCpf(value) {
  return String(value || '').replace(/\D/g, '');
}

// ─── Helper: assina JWT ──────────────────────────────────────────────────────

/**
 * Assina um JWT usando env.JWT_SECRET (validado pela startup).
 *
 * Mudança de formato: agora usa 'sub' (subject, padrão JWT RFC 7519)
 * em vez de 'id', para consistência com punchController.js.
 */
function signToken(id, role) {
  return jwt.sign(
    { sub: String(id), role },
    env.JWT_SECRET, // ✅ CORREÇÃO #2: usa env.JWT_SECRET
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

// ─── loginAdmin ──────────────────────────────────────────────────────────────

/**
 * Login de administrador via CPF/email + senha (JWT).
 *
 * NOTA: O sistema atual usa Gov.br OAuth para admin.
 * Este endpoint é legado e não está montado no app.js atual.
 */
async function loginAdmin(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const senha = String(req.body.senha || '');
    const unauthorizedMessage = 'E-mail ou senha incorretos';

    if (!email || !senha) {
      return res.status(401).json({ message: unauthorizedMessage });
    }

    // ✅ CORREÇÃO #1: usa executeOne de database.js (com assertSqlAndParams)
    const admin = await executeOne(
      'SELECT id, email, senha_hash FROM admins WHERE email = ? AND ativo = 1 LIMIT 1',
      [email]
    );

    const senhaValida = admin ? await bcrypt.compare(senha, admin.senha_hash) : false;

    if (!admin || !senhaValida) {
      return res.status(401).json({ message: unauthorizedMessage });
    }

    const token = signToken(admin.id, 'admin');

    // ✅ CORREÇÃO #1: usa execute de database.js
    await execute('UPDATE admins SET ultimo_login_em = NOW() WHERE id = ?', [admin.id]);
    res.setHeader('Set-Cookie', buildAdminAuthCookie(token));

    return res.status(200).json({ token });
  } catch (error) {
    return next(error);
  }
}

// ─── loginFuncionario ────────────────────────────────────────────────────────

/**
 * Login de funcionário via CPF/email + senha (JWT).
 *
 * NOTA: O sistema atual usa punchController.js::loginFuncionario via /ponto/login.
 * Este é o endpoint legado (routes/auth.js → não montado no app.js atual).
 *
 * CORREÇÕES:
 * - Usa executeOne de database.js (em vez de pool.execute com desestruturação)
 * - Usa env.JWT_SECRET (em vez de process.env.JWT_SECRET)
 * - Verifica ativo diretamente na query de funcionários
 */
async function loginFuncionario(req, res, next) {
  try {
    const rawLogin = String(req.body.login || req.body.email || req.body.cpf || '').trim();
    const cpf = normalizeCpf(rawLogin || req.body.cpf);
    const email = rawLogin.includes('@') ? rawLogin.toLowerCase() : '';
    const senha = String(req.body.senha || '');
    const unauthorizedMessage = 'CPF/email ou senha incorretos';

    if (!rawLogin || !senha) {
      return res.status(401).json({ message: unauthorizedMessage });
    }

    // ✅ CORREÇÃO #1: usa executeOne de database.js
    // Determina o campo de busca (email ou cpf) com base no login informado
    // Nota: o campo no WHERE é decidido por uma condição booleana, não por input do usuário
    const funcionario = await executeOne(
      `SELECT id, cpf, nome, email, senha, ativo
       FROM funcionarios
       WHERE ${email ? 'email = ?' : 'cpf = ?'}
       LIMIT 1`,
      [email || cpf]
    );

    const senhaValida = funcionario
      ? await bcrypt.compare(senha, String(funcionario.senha || ''))
      : false;

    if (!funcionario || !senhaValida || !funcionario.ativo) {
      return res.status(401).json({ message: unauthorizedMessage });
    }

    // ✅ CORREÇÃO #2: usa env.JWT_SECRET via signToken()
    const token = signToken(funcionario.id, 'funcionario');

    return res.status(200).json({ token });
  } catch (error) {
    return next(error);
  }
}

// ─── logoutAdmin ─────────────────────────────────────────────────────────────

function logoutAdmin(_req, res) {
  res.setHeader('Set-Cookie', buildClearAdminAuthCookie());
  return res.status(200).json({ message: 'Logout realizado com sucesso' });
}

module.exports = {
  loginAdmin,
  loginFuncionario,
  logoutAdmin,
};
