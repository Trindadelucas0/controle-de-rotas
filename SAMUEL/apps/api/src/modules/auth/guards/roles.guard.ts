import { CanActivate, ExecutionContext, Injectable, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY, AuthUser } from '../decorators/auth.decorators';
import { authError } from '../auth.errors';

/** PLATFORM_ADMIN herda tudo que ADMIN pode (escopo operacional do próprio tenant). */
function roleAllowed(userRole: UserRole, allowed: UserRole[]): boolean {
  if (allowed.includes(userRole)) return true;
  if (userRole === UserRole.PLATFORM_ADMIN && allowed.includes(UserRole.ADMIN)) {
    return true;
  }
  return false;
}

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
    if (!user || !roleAllowed(user.role, roles)) {
      throw authError(HttpStatus.FORBIDDEN, 'AUTH_FORBIDDEN', 'Você não tem permissão para esta ação.');
    }
    return true;
  }
}
