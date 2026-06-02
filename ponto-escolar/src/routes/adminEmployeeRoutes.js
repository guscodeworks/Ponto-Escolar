'use strict';

/**
 * ROTAS DE FUNCIONÁRIOS (ADMIN) — adminEmployeeRoutes.js (ATUALIZADO)
 *
 * MUDANÇA: substituímos os validators do express-validator pelos schemas Zod.
 *
 * Adicionamos requireRole(['admin']) para tornar a autorização explícita,
 * embora ensureAdminApiAuthenticated (montado no index.js) já garanta
 * que só admins Gov.br acessam este router.
 * A dupla proteção é uma boa prática: se o router for montado em outro lugar,
 * o requireRole ainda protege cada rota individualmente.
 */

const { Router } = require('express');
const {
  createEmployee,
  listEmployees,
  updateEmployee,
  setEmployeeStatus,
} = require('../controllers/adminEmployeeController');
const { sensitiveLimiter } = require('../middlewares/rateLimiters');
const { requireRole } = require('../middlewares/role.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  criarFuncionarioSchema,
  atualizarFuncionarioSchema,
  statusFuncionarioSchema,
  listarFuncionariosSchema,
} = require('../schemas/funcionario.schema');

const router = Router();

// Todas as rotas neste router exigem role 'admin'
// (ensureAdminApiAuthenticated no index.js já garante isso,
//  mas ser explícito aqui é uma camada extra de defesa)
router.use(requireRole(['admin']));

// GET  /api/admin/funcionarios
router.get(
  '/',
  validate(listarFuncionariosSchema),
  listEmployees
);

// POST /api/admin/funcionarios
router.post(
  '/',
  sensitiveLimiter,
  validate(criarFuncionarioSchema),
  createEmployee
);

// PATCH /api/admin/funcionarios/:id
router.patch(
  '/:id',
  sensitiveLimiter,
  validate(atualizarFuncionarioSchema),
  updateEmployee
);

// PATCH /api/admin/funcionarios/:id/status
router.patch(
  '/:id/status',
  sensitiveLimiter,
  validate(statusFuncionarioSchema),
  setEmployeeStatus
);

module.exports = router;
