import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError, type ErrorCode } from '../errors/app-error';

const httpStatuses: Record<ErrorCode, number> = {
  DADOS_INVALIDOS: 400,
  NAO_AUTENTICADO: 401,
  CREDENCIAIS_INVALIDAS: 401,
  ACESSO_NEGADO: 403,
  RECURSO_NAO_ENCONTRADO: 404,
  EMAIL_JA_CADASTRADO: 409,
  CPF_JA_CADASTRADO: 409,
  CRM_JA_CADASTRADO: 409,
  HORARIO_INDISPONIVEL: 409,
  PACIENTE_INDISPONIVEL: 409,
  HORARIO_FORA_DA_ESCALA: 422,
  TRANSICAO_INVALIDA: 422,
};

export type ErrorLogger = (error: unknown) => void;

function defaultLogger(error: unknown): void {
  console.error(
    'Erro inesperado na API:',
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : 'Erro sem detalhes',
  );
}

export function createErrorMiddleware(log: ErrorLogger = defaultLogger): ErrorRequestHandler {
  return (error: unknown, _request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }
    let code: ErrorCode | 'ERRO_INTERNO' = 'ERRO_INTERNO';
    let statusCode = 500;
    let message = 'Erro interno do servidor.';
    if (error instanceof AppError) {
      code = error.code;
      statusCode = httpStatuses[code];
      message = error.message;
    } else if (error instanceof ZodError) {
      code = 'DADOS_INVALIDOS';
      statusCode = 400;
      message = 'Dados de entrada inválidos.';
    } else if (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      (error.type === 'entity.parse.failed' || error.type === 'entity.too.large')
    ) {
      code = 'DADOS_INVALIDOS';
      statusCode = 400;
      message = 'Corpo JSON inválido ou maior que o limite permitido.';
    } else {
      log(error);
    }
    response.status(statusCode).json({ statusCode, error: code, message });
  };
}
