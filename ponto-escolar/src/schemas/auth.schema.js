'use strict';

/**
 * SCHEMAS DE AUTENTICAÇÃO — Zod
 *
 * O que é Zod?
 * Zod é uma biblioteca de validação baseada em schema. Diferente do express-validator
 * (que valida campo a campo em cadeia), o Zod descreve o "formato ideal" do dado
 * em um objeto e valida tudo de uma vez.
 *
 * Por que isso é mais seguro?
 * 1. Você define claramente o que ACEITA — qualquer coisa fora disso é rejeitada.
 * 2. .transform() limpa/normaliza os dados antes de chegarem no controller.
 * 3. O schema é uma documentação viva do que a rota espera.
 */

const { z } = require('zod');
const { isValidCpf, normalizeCpf } = require('../utils/cpf');

// ─── Regex ────────────────────────────────────────────────────────────────────

// QR Code deve ser exatamente 64 caracteres hexadecimais (minúsculos ou maiúsculos)
const QR_TOKEN_REGEX = /^[a-f0-9]{64}$/i;

// ─── Campos reutilizáveis ────────────────────────────────────────────────────

/**
 * Campo de senha: string, mínimo 8, máximo 72 chars.
 * O limite de 72 é o máximo do bcrypt — caracteres além disso são ignorados.
 */
const senhaField = z
  .string({ required_error: 'Senha é obrigatória', invalid_type_error: 'Senha deve ser texto' })
  .min(8, 'Senha deve ter ao menos 8 caracteres')
  .max(72, 'Senha deve ter no máximo 72 caracteres (limite bcrypt)');

/**
 * Campo de email: string, formato de email, máximo 150 chars.
 * .transform() normaliza para minúsculo.
 */
const emailField = z
  .string({ required_error: 'Email é obrigatório', invalid_type_error: 'Email deve ser texto' })
  .email('Email inválido')
  .max(150, 'Email muito longo')
  .transform((v) => v.trim().toLowerCase());

/**
 * Campo de CPF: aceita formatado (000.000.000-00) ou só dígitos.
 * .transform() remove formatação, .refine() valida dígito verificador.
 */
const cpfField = z
  .string({ required_error: 'CPF é obrigatório', invalid_type_error: 'CPF deve ser texto' })
  .transform((v) => normalizeCpf(v)) // remove pontos e traço
  .refine((v) => v.length === 11, 'CPF deve ter 11 dígitos')
  .refine((v) => isValidCpf(v), 'CPF inválido');

/**
 * Campo de QR Code: string com exatamente 64 chars hexadecimais.
 * Suporta os nomes: qrCode, qr_code, qrToken (unificado via preprocessing).
 */
const qrCodeField = z
  .string({ required_error: 'QR Code é obrigatório' })
  .trim()
  .min(1, 'QR Code é obrigatório')
  .regex(QR_TOKEN_REGEX, 'QR Code inválido — formato não reconhecido');

// ─── Schema: Login de Administrador ─────────────────────────────────────────

/**
 * POST /api/admin/auth/login  (via adminAuthRoutes)
 *
 * Risco anterior: sem validação de schema.
 * Agora: valida email (formato) + senha (tamanho), rejeita XSS e tipos errados.
 */
const adminLoginSchema = z.object({
  body: z.object({
    email: emailField,
    senha: senhaField,
  }),
});

// ─── Schema: Login de Funcionário ───────────────────────────────────────────

/**
 * POST /ponto/login
 *
 * O body pode conter qrCode, qr_code OU qrToken — todos são aceitos.
 * O controller unifica com: req.body.qrCode || req.body.qr_code || req.body.qrToken
 *
 * Identificação: CPF ou email (pelo menos um deve ser enviado, validado no controller).
 * Senha: obrigatória.
 */
const funcionarioLoginSchema = z.object({
  body: z
    .object({
      // QR Code — aceita qualquer um dos três nomes
      qrCode:   qrCodeField.optional(),
      qr_code:  z.string().optional(),
      qrToken:  z.string().optional(),

      // Identificação do funcionário (cpf OU email)
      login: z.string().trim().min(3, 'Login muito curto').max(150).optional(),
      cpf:   cpfField.optional(),
      email: emailField.optional(),

      // Senha
      senha: senhaField,
    })
    .refine(
      (data) => {
        // Pelo menos um QR Code deve estar presente
        const qr = data.qrCode || data.qr_code || data.qrToken;
        return !!qr && QR_TOKEN_REGEX.test(qr.trim());
      },
      { message: 'QR Code inválido ou ausente', path: ['qrCode'] }
    ),
});

// ─── Schema: Registrar Ponto (Bater Ponto) ──────────────────────────────────

/**
 * POST /ponto/bater  ou  POST /ponto/registrar
 *
 * Requer: QR Code + localização GPS (latitude e longitude).
 * A validação de distância da escola é feita no controller (regra de negócio).
 */
const baterPontoSchema = z.object({
  body: z
    .object({
      qrCode:  qrCodeField.optional(),
      qr_code: z.string().optional(),
      qrToken: z.string().optional(),

      latitude: z
        .number({ required_error: 'Latitude é obrigatória', invalid_type_error: 'Latitude deve ser número' })
        .min(-90, 'Latitude inválida — deve ser entre -90 e 90')
        .max(90, 'Latitude inválida — deve ser entre -90 e 90'),

      longitude: z
        .number({ required_error: 'Longitude é obrigatória', invalid_type_error: 'Longitude deve ser número' })
        .min(-180, 'Longitude inválida — deve ser entre -180 e 180')
        .max(180, 'Longitude inválida — deve ser entre -180 e 180'),
    })
    .refine(
      (data) => {
        const qr = data.qrCode || data.qr_code || data.qrToken;
        return !!qr && QR_TOKEN_REGEX.test(qr.trim());
      },
      { message: 'QR Code inválido ou ausente', path: ['qrCode'] }
    ),
});

module.exports = {
  adminLoginSchema,
  funcionarioLoginSchema,
  baterPontoSchema,
  // Campos reutilizáveis (podem ser importados em outros schemas)
  senhaField,
  emailField,
  cpfField,
  qrCodeField,
};
