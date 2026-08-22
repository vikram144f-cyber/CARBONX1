export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export class NotFoundError extends ServiceError {
  constructor(message: string) {
    super(message, "NOT_FOUND", 404);
  }
}

export class InvalidInputError extends ServiceError {
  constructor(message: string) {
    super(message, "INVALID_INPUT", 400);
  }
}

export class ConflictError extends ServiceError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}
