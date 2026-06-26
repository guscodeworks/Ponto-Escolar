'use strict';

/**
 * SCHEMAS DE FUNCIONÁRIO — Zod
 *
 * Validação para criação, edição e listagem de funcionários.
 * Importa campos reutilizáveis do auth.schema.js.
 */

const { z } = require('zod');
const { senhaField, emailField, cpfField } = require('./auth.schema');

// ─── Campo: Nome ─────────────────────────────────────────────────────────────

/**
 * Nome do funcionário:
 * - Mínimo 3, máximo 55 caracteres
 * - Sem < > (previne XSS básico na exibição)
 * - .trim() remove espaços extras nas bordas
 */
const nomeField = z
  .string({ required_error: 'Nome é obrigatório', invalid_type_error: 'Nome deve ser texto' })
  .trim()
  .min(3, 'Nome deve ter ao menos 3 caracteres')
  .max(55, 'Nome deve ter no máximo 55 caracteres')
  .regex(/^[^<>]+$/, 'Nome contém caracteres inválidos (< ou >)');

// ─── Campo: cargo_id ─────────────────────────────────────────────────────────

const cargoIdField = z
  .number({ invalid_type_error: 'cargo_id deve ser número inteiro' })
  .int('cargo_id deve ser número inteiro')
  .min(1, 'cargo_id inválido — deve ser maior que zero');

// ─── Schema: Criar Funcionário ───────────────────────────────────────────────

/**
 * POST /api/admin/funcionarios
 *
 * Todos os campos são obrigatórios exceto cargo_id e ativo.
 *
 * Por que valida cargo_id?
 * Sem validação, um cliente malicioso poderia enviar cargo_id=-1 ou cargo_id="abc",
 * causando erro de banco ou comportamento inesperado.
 */
const criarFuncionarioSchema = z.object({
  body: z.object({
    nome:     nomeField,
    cpf:      cpfField,
    email:    emailField,
    senha:    senhaField,
    cargo_id: cargoIdField.optional(),
    ativo: z
      .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
      .transform((v) => {
        if (typeof v === 'boolean') return v;
        return v === 'true' || v === '1';
      })
      .default(true),
  }),
});

// ─── Schema: Atualizar Funcionário ───────────────────────────────────────────

/**
 * PATCH /api/admin/funcionarios/:id
 *
 * Todos os campos são opcionais (atualização parcial).
 * Pelo menos um campo deve ser enviado (validado no controller).
 */
const atualizarFuncionarioSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((v) => Number(v))
      .refine((v) => Number.isInteger(v) && v > 0, 'ID de funcionário inválido'),
  }),
  body: z.object({
    nome:     nomeField.optional(),
    cpf:      cpfField.optional(),
    email:    emailField.optional(),
    senha:    senhaField.optional(),
    cargo_id: cargoIdField.optional(),
    ativo: z
      .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
      .transform((v) => {
        if (typeof v === 'boolean') return v;
        return v === 'true' || v === '1';
      })
      .optional(),
  }),
});

// ─── Schema: Alterar Status (ativo/inativo) ───────────────────────────────────

/**
 * PATCH /api/admin/funcionarios/:id/status
 */
const statusFuncionarioSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((v) => Number(v))
      .refine((v) => Number.isInteger(v) && v > 0, 'ID de funcionário inválido'),
  }),
  body: z.object({
    ativo: z
      .union([z.boolean(), z.enum(['true', 'false', '1', '0'])], {
        required_error: 'Campo "ativo" é obrigatório',
      })
      .transform((v) => {
        if (typeof v === 'boolean') return v;
        return v === 'true' || v === '1';
      }),
  }),
});

// ─── Schema: Listagem / Paginação ────────────────────────────────────────────

/**
 * GET /api/admin/funcionarios?page=1&limit=20&ativo=true&q=joao
 *
 * Por que validar query params?
 * Sem validação, um cliente poderia enviar page=-1, limit=99999 ou q=<script>.
 * Isso poderia causar queries pesadas ou problemas de XSS na resposta.
 */
const listarFuncionariosSchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .default('1')
      .transform((v) => Number(v))
      .refine((v) => Number.isInteger(v) && v >= 1, 'page deve ser >= 1'),
    limit: z
      .string()
      .optional()
      .default('20')
      .transform((v) => Number(v))
      .refine((v) => Number.isInteger(v) && v >= 1 && v <= 100, 'limit deve ser entre 1 e 100'),
    ativo: z
      .enum(['true', 'false', '1', '0'])
      .optional()
      .transform((v) => {
        if (v === undefined) return undefined;
        return v === 'true' || v === '1';
      }),
    q: z
      .string()
      .trim()
      .max(120, 'Busca muito longa — máximo 120 caracteres')
      .regex(/^[^<>]*$/, 'Busca contém caracteres inválidos')
      .optional(),
  }),
});

module.exports = {
  criarFuncionarioSchema,
  atualizarFuncionarioSchema,
  statusFuncionarioSchema,
  listarFuncionariosSchema,
  // Campos reutilizáveis
  nomeField,
  cargoIdField,
};
