'use strict';

/**
 * MIDDLEWARE DE ROLES (RBAC) — roleMiddleware
 *
 * PROBLEMA ANTERIOR:
 * A autorização era feita implicitamente — cada rota usava um middleware
 * diferente (ensureAdminApiAuthenticated vs authenticateFuncionario), e
 * não havia um padrão explícito de "somente role X pode acessar aqui".
 *
 * SOLUÇÃO:
 * Um middleware declarativo que verifica se o usuário autenticado possui
 * o role (papel) necessário para acessar a rota.
 *
 * IMPORTANTE:
 * Este middleware DEVE ser usado APÓS um middleware de autenticação que
 * popule req.auth (ex: ensureAdminApiAuthenticated ou authenticateFuncionario).
 * Sem req.auth, ele retorna 401 (não autenticado).
 *
 * USO:
 *   const { requireRole } = require('../middlewares/role.middleware');
 *
 *   // Apenas admins podem deletar funcionários
 *   router.delete(
 *     '/funcionario/:id',
 *     ensureAdminApiAuthenticated,
 *     requireRole(['admin']),
 *     controller.deletarFuncionario
 *   );
 *
 *   // Apenas funcionários podem bater ponto
 *   router.post(
 *     '/bater',
 *     authenticateFuncionario,
 *     requireRole(['funcionario']),
 *     controller.baterPonto
 *   );
 *
 * POR QUE O BACKEND VALIDA E NÃO O FRONTEND:
 * O frontend é código que roda no navegador do usuário — ele pode ser
 * modificado ou ignorado. O backend é a única fonte de verdade. Se uma rota
 * não verificar o role, qualquer usuário autenticado (mesmo com role errado)
 * pode acessá-la.
 */

const { ForbiddenError, UnauthorizedError } = require('../utils/errors');

/**
 * Cria um middleware que exige que o usuário autenticado possua um dos roles listados.
 *
 * @param {string[]} allowedRoles - Ex: ['admin'], ['funcionario'], ['admin', 'funcionario']
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.delete('/:id', authMiddleware, requireRole(['admin']), controller.delete);
 */
function requireRole(allowedRoles) {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    throw new TypeError('requireRole() requer um array não-vazio de roles permitidos');
  }

  return (req, _res, next) => {
    // Sem req.auth → middleware de autenticação não foi chamado antes
    if (!req.auth) {
      return next(new UnauthorizedError('Autenticação necessária'));
    }

    const userRole = String(req.auth.role || '').toLowerCase();
    const allowed = allowedRoles.map((r) => String(r).toLowerCase());

    if (!allowed.includes(userRole)) {
      return next(
        new ForbiddenError(
          `Acesso negado. Role necessário: [${allowed.join(', ')}]. Role atual: ${userRole || 'nenhum'}`
        )
      );
    }

    return next();
  };
}

module.exports = { requireRole };
