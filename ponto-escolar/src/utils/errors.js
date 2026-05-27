'use strict';

class HttpError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
  }
}

class BadRequestError extends HttpError {
  constructor(message = 'Requisicao invalida') {
    super(message, 400, 'BAD_REQUEST');
  }
}

class UnauthorizedError extends HttpError {
  constructor(message = 'Nao autorizado') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends HttpError {
  constructor(message = 'Acesso negado') {
    super(message, 403, 'FORBIDDEN');
  }
}

function normalizeError(error) {
  return error;
}

module.exports = {
  HttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  normalizeError
};
