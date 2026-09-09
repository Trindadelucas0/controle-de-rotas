import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Erro interno do servidor.';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const obj = body as Record<string, unknown>;
        if (typeof obj.code === 'string') code = obj.code;
        if (typeof obj.message === 'string') {
          message = obj.message;
        } else if (Array.isArray(obj.message)) {
          code = code === 'INTERNAL_ERROR' ? 'AUTH_VALIDATION' : code;
          message = obj.message.join('; ');
        }
        if (statusCode === HttpStatus.BAD_REQUEST && code === 'INTERNAL_ERROR') {
          code = 'AUTH_VALIDATION';
        }
        if (statusCode === HttpStatus.UNAUTHORIZED && code === 'INTERNAL_ERROR') {
          code = 'AUTH_UNAUTHORIZED';
        }
        if (statusCode === HttpStatus.FORBIDDEN && code === 'INTERNAL_ERROR') {
          code = 'AUTH_FORBIDDEN';
        }
        if (statusCode === HttpStatus.TOO_MANY_REQUESTS && code === 'INTERNAL_ERROR') {
          code = 'AUTH_RATE_LIMITED';
        }
      }
    }

    if (
      statusCode === HttpStatus.NOT_FOUND &&
      /^Cannot (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /i.test(message)
    ) {
      code = 'NOT_FOUND';
      message = 'Recurso não encontrado.';
    }

    if (!(exception instanceof HttpException)) {
      // eslint-disable-next-line no-console
      console.error('[unhandled]', exception);
    }

    response.status(statusCode).json({ statusCode, code, message });
  }
}
