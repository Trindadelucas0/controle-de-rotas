import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AuthRepository } from '../auth.repository';
import { AuthUser } from '../decorators/auth.decorators';
import { UserStatus } from '@prisma/client';

type JwtPayload = {
  sub: string;
  email: string;
  role: AuthUser['role'];
  companyId: string;
  name: string;
};

function cookieExtractor(req: Request): string | null {
  if (req?.cookies?.access_token) {
    return req.cookies.access_token as string;
  }
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly authRepository: AuthRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') || 'change-me-access-min-32-chars-long!!',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser | null> {
    const user = await this.authRepository.findUserById(payload.sub);
    if (!user || user.status !== UserStatus.ACTIVE) {
      return null;
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      name: user.name,
    };
  }
}
