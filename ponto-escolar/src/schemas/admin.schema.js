'use strict';

/**
 * SCHEMAS DE ADMINISTRAÇÃO — Zod
 *
 * Validação para rotas administrativas: QR tokens, datas de relatórios, etc.
 */

const { z } = require('zod');

// ─── Schema: ID de recurso (parâmetro de rota) ───────────────────────────────

/**
 * Reutilizável para qualquer rota com /:id
 * Exemplo: GET /api/admin/qr-tokens/:id
 */
const idParamSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((v) => Number(v))
      .refine((v) => Number.isInteger(v) && v > 0, 'ID inválido — deve ser inteiro positivo'),
  }),
});

// ─── Schema: Validação de QR Token ───────────────────────────────────────────

/**
 * POST /api/admin/qr-tokens/validate
 *
 * Por que validar o formato antes de consultar o banco?
 * Um QR Code de 64 chars hex mal-formado nunca vai existir no banco.
 * Rejeitar no middleware poupa uma query desnecessária.
 */
const QR_TOKEN_REGEX = /^[a-f0-9]{64}$/i;

const validarQrTokenSchema = z.object({
  body: z.object({
    qrCode: z
      .string({ required_error: 'QR Code é obrigatório' })
      .trim()
      .regex(QR_TOKEN_REGEX, 'QR Code inválido — deve ter 64 caracteres hexadecimais'),
  }),
});

// ─── Schema: Data para relatórios ────────────────────────────────────────────

/**
 * GET /api/admin/pontos?data=2025-05-01
 *
 * Por que validar o formato de data?
 * Sem validação, a string passada poderia ser injetada em um template de query
 * ou causar erros silenciosos (ex: "2025-13-99" seria aceita pelo MySQL mas
 * retornaria resultados vazios sem explicação).
 */
const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const relatorioQuerySchema = z.object({
  query: z.object({
    data: z
      .string()
      .optional()
      .refine((v) => !v || DATA_REGEX.test(v), 'Data inválida — use o formato YYYY-MM-DD')
      .refine((v) => {
        if (!v) return true;
        const parsed = new Date(v);
        return !isNaN(parsed.getTime());
      }, 'Data inválida — data não existe no calendário'),
  }),
});

module.exports = {
  idParamSchema,
  validarQrTokenSchema,
  relatorioQuerySchema,
};
