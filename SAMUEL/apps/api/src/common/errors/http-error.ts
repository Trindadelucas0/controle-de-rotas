import { HttpException, HttpStatus } from '@nestjs/common';

export function httpError(
  statusCode: HttpStatus,
  code: string,
  message: string,
): HttpException {
  return new HttpException({ statusCode, code, message }, statusCode);
}
