'use strict';

/**
 * ROTAS DE PONTO — punchRoutes.js (ATUALIZADO)
 *
 * MUDANÇA: substituímos os validators do express-validator
 * pelos novos schemas Zod + middleware validate().
 *
 * ANTES:
 *   router.post('/login', funcionarioLoginValidator, loginFuncionario);
 *   // funcionarioLoginValidator era uma cadeia de ~20 linhas em validators.js
 *
 * DEPOIS:
 *   router.post('/login', validate(funcionarioLoginSchema), loginFuncionario);
 *   // Schema Zod declarado em src/schemas/auth.schema.js — legível, reutilizável
 *
 * Também adicionamos requireRole(['funcionario']) para tornar explícito
 * que /bater e /registrar são exclusivos de funcionários.
 */

const { Router } = require('express');
const { loginFuncionario, registerPunch } = require('../controllers/punchController');
const { authenticateFuncionario } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/role.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { loginLimiter, pointLimiter } = require('../middlewares/rateLimiters');
const { funcionarioLoginSchema, baterPontoSchema } = require('../schemas/auth.schema');
const { MethodNotAllowedError } = require('../utils/errors');

const router = Router();

function attachPunchQrFromSession(req, _res, next) {
  const bodyQrCode = String(req.body?.qrCode || req.body?.qr_code || req.body?.qrToken || '').trim();
  const sessionQrCode = String(req.session?.punchAccess?.qrCode || '').trim();

  if (!bodyQrCode && sessionQrCode) {
    req.body = {
      ...req.body,
      qrCode: sessionQrCode
    };
  }

  return next();
}

// ─── POST /ponto/login ────────────────────────────────────────────────────────
// validate(funcionarioLoginSchema) substitui funcionarioLoginValidator
router.post(
  '/login',
  loginLimiter,
  attachPunchQrFromSession,
  validate(funcionarioLoginSchema),
  loginFuncionario
);

// ─── POST /ponto/bater ────────────────────────────────────────────────────────
// authenticate → verifica JWT e preenche req.auth
// requireRole  → garante que o role é 'funcionario' (novo!)
// validate     → valida QR Code + lat/lng com Zod
router.post(
  '/bater',
  pointLimiter,
  authenticateFuncionario,
  requireRole(['funcionario']),
  attachPunchQrFromSession,
  validate(baterPontoSchema),
  registerPunch
);

// ─── POST /ponto/registrar ────────────────────────────────────────────────────
// Alias de /bater, mesmo pipeline de segurança
router.post(
  '/registrar',
  pointLimiter,
  authenticateFuncionario,
  requireRole(['funcionario']),
  attachPunchQrFromSession,
  validate(baterPontoSchema),
  registerPunch
);

// ─── Métodos não permitidos ───────────────────────────────────────────────────
router.all('/bater', (_req, _res, next) =>
  next(new MethodNotAllowedError('Use POST para bater ponto', { allowedMethods: ['POST'] }))
);
router.all('/login', (_req, _res, next) =>
  next(new MethodNotAllowedError('Use POST para login', { allowedMethods: ['POST'] }))
);
router.all('/registrar', (_req, _res, next) =>
  next(new MethodNotAllowedError('Use POST para registrar ponto', { allowedMethods: ['POST'] }))
);

module.exports = router;
