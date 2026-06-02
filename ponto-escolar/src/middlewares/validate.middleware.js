'use strict';

/**
 * MIDDLEWARE DE VALIDAÇÃO — validate(schema)
 *
 * PROBLEMA ANTERIOR:
 * A validação estava espalhada em `validators.js` usando express-validator,
 * que valida cada campo separadamente com uma cadeia de chamadas encadeadas.
 *
 * SOLUÇÃO:
 * Um middleware genérico `validate(schema)` que recebe um schema Zod
 * e valida de uma vez: body, params e query.
 *
 * USO:
 *   const { validate } = require('../middlewares/validate.middleware');
 *   const { adminLoginSchema } = require('../schemas/auth.schema');
 *
 *   router.post('/login', validate(adminLoginSchema), controller.login);
 *
 * COMO FUNCIONA:
 * 1. O schema Zod descreve o "shape" esperado de { body, params, query }.
 * 2. O middleware monta um objeto com os três e chama schema.safeParse().
 * 3. Se inválido → retorna 422 com a lista de erros (campo + mensagem).
 * 4. Se válido → substitui req.body/params/query pelos valores transformados.
 *    Isso garante que o controller recebe dados limpos (ex: CPF sem pontos).
 *
 * POR QUE ISSO É MAIS SEGURO:
 * - Rejeita tipos errados antes de qualquer lógica de negócio.
 * - Transforma e normaliza dados (ex: email.toLowerCase()).
 * - Impede que campos inesperados passem para o controller.
 */

const { ZodError } = require('zod');
const { ValidationError } = require('../utils/errors');

/**
 * @param {import('zod').ZodObject} schema
 * @returns {import('express').RequestHandler}
 */
function validate(schema) {
  return (req, _res, next) => {
    try {
      // Monta o objeto para validar apenas as partes que o schema define
      const toValidate = {};

      const schemaShape = schema.shape || {};

      if (schemaShape.body)   toValidate.body   = req.body;
      if (schemaShape.params) toValidate.params = req.params;
      if (schemaShape.query)  toValidate.query  = req.query;

      // safeParse não lança exceção — retorna { success, data, error }
      const result = schema.safeParse(toValidate);

      if (!result.success) {
        // Formata os erros do Zod para o padrão da API
        const details = result.error.errors.map((e) => {
          // e.path é um array como ['body', 'email'] — removemos o primeiro nível
          const pathWithoutLevel = e.path.slice(1);
          return {
            field: pathWithoutLevel.join('.') || e.path.join('.'),
            message: e.message,
          };
        });

        return next(new ValidationError('Dados de requisição inválidos', details));
      }

      // Substitui os dados no req pelos valores transformados pelo Zod
      // (ex: CPF normalizado, email em lowercase, números convertidos de string)
      if (result.data.body   !== undefined) req.body   = result.data.body;
      if (result.data.params !== undefined) req.params = result.data.params;
      if (result.data.query  !== undefined) req.query  = result.data.query;

      return next();
    } catch (error) {
      // Erro inesperado no próprio schema — não é erro do usuário
      return next(error);
    }
  };
}

module.exports = { validate };
