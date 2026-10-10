export type ErrorCode =
  | 'DADOS_INVALIDOS'
  | 'NAO_AUTENTICADO'
  | 'CREDENCIAIS_INVALIDAS'
  | 'ACESSO_NEGADO'
  | 'RECURSO_NAO_ENCONTRADO'
  | 'EMAIL_JA_CADASTRADO'
  | 'CPF_JA_CADASTRADO'
  | 'CRM_JA_CADASTRADO'
  | 'HORARIO_INDISPONIVEL'
  | 'PACIENTE_INDISPONIVEL'
  | 'HORARIO_FORA_DA_ESCALA'
  | 'TRANSICAO_INVALIDA';

// O domínio descreve o erro. Apenas a borda HTTP decide o status da resposta.
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
