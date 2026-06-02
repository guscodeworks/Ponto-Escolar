'use strict';

/**
 * MIDDLEWARE auth.js — CORRIGIDO
 *
 * PROBLEMA ENCONTRADO:
 * Este arquivo usava process.env.JWT_SECRET direto,
 * pulando a validação do módulo env.js.
 *
 * CORREÇÃO: Usa env.JWT_SECRET (validado na startup).
 */

const jwt = require('jsonwebtoken');
// ✅ CORREÇÃO: importa env validado em vez de process.env direto
const env = require('../config/env');
const { getAdminAuthCookie } = require('../utils/authCookie');

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== 'string') {
    return getAdminAuthCookie(req);
  }
  const [scheme, token] = authHeader.split(' ');
  return /^Bearer$/i.test(scheme) && token ? token.trim() : getAdminAuthCookie(req);
}

function verifyRole(expectedRole) {
  return (req, res, next) => {
    try {
      const token = getBearerToken(req);
      if (!token) {
        return res.status(401).json({ message: 'Acesso não autorizado' });
      }

      // ✅ CORREÇÃO: usa env.JWT_SECRET em vez de process.env.JWT_SECRET
      const payload = jwt.verify(token, env.JWT_SECRET);

      if (payload.role !== expectedRole) {
        return res.status(403).json({ message: 'Acesso proibido para este perfil' });
      }

      req.user = {
        id: payload.sub || payload.id,
        role: payload.role,
      };

      return next();
    } catch (_error) {
      return res.status(401).json({ message: 'Token inválido ou expirado' });
    }
  };
}

module.exports = {
  verifyAdmin: verifyRole('admin'),
  verifyFuncionario: verifyRole('funcionario'),
};
