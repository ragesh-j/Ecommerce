
export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // expected errors (validation, auth etc.)
    Error.captureStackTrace(this, this.constructor);
  }
}