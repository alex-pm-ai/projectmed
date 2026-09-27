export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 400, code = 'bad_request') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autenticado') {
    super(message, 401, 'unauthorized');
  }
}

export class PaymentRequiredError extends AppError {
  constructor(message = 'Assinatura inativa') {
    super(message, 402, 'assinatura_inativa');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Não encontrado') {
    super(message, 404, 'not_found');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflito') {
    super(message, 409, 'conflict');
  }
}
