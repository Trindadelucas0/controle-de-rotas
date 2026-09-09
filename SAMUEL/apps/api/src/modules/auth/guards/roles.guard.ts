import { CanActivate, ExecutionContext, Injectable, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY, AuthUser } from '../decorators/auth.decorators';
import { authError } from '../auth.errors';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user || !roles.includes(user.role)) {
      throw authError(HttpStatus.FORBIDDEN, 'AUTH_FORBIDDEN', 'Você não tem permissão para esta ação.');
    }
    return true;
  }
}
