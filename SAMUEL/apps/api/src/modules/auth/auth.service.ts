import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { Response, Request } from 'express';
import { AuthRepository, UserWithCompany } from './auth.repository';
import { RedisService } from '../../common/redis/redis.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { authError } from './auth.errors';
import { AuthUser } from './decorators/auth.decorators';
import { UserStatus } from '@prisma/client';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  company: { id: string; name: string };
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  toPublicUser(user: UserWithCompany): PublicUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      company: { id: user.company.id, name: user.company.name },
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDurationMs(value: string, fallbackMs: number): number {
    const match = /^(\d+)([smhd])$/i.exec(value.trim());
    if (!match) return fallbackMs;
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const mult =
      unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
    return amount * mult;
  }

  private cookieOptions(maxAgeMs: number) {
    const secure = this.config.get<string>('COOKIE_SECURE') === 'true';
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      path: '/',
      secure,
      maxAge: maxAgeMs,
    };
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL') || '15m';
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL') || '7d';
    const accessMs = this.parseDurationMs(accessTtl, 15 * 60_000);
    const refreshMs = this.parseDurationMs(refreshTtl, 7 * 86_400_000);

    res.cookie(ACCESS_COOKIE, accessToken, this.cookieOptions(accessMs));
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions(refreshMs));
  }

  clearAuthCookies(res: Response) {
    const secure = this.config.get<string>('COOKIE_SECURE') === 'true';
    const base = { httpOnly: true, sameSite: 'lax' as const, path: '/', secure };
    res.clearCookie(ACCESS_COOKIE, base);
    res.clearCookie(REFRESH_COOKIE, base);
  }

  private clientMeta(req: Request) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket.remoteAddress ||
      undefined;
    const userAgent = req.headers['user-agent'];
    return { ip, userAgent };
  }

  private async assertRateLimit(key: string, max: number, windowSec: number) {
    const count = await this.redis.incrWithTtl(key, windowSec);
    if (count > max) {
      throw authError(
        HttpStatus.TOO_MANY_REQUESTS,
        'AUTH_RATE_LIMITED',
        'Muitas tentativas. Aguarde e tente de novo.',
      );
    }
  }

  private signAccessToken(user: UserWithCompany): string {
    const expiresIn = (this.config.get<string>('JWT_ACCESS_TTL') || '15m') as `${number}m`;
    return this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        name: user.name,
      },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn,
      },
    );
  }

  private async issueRefreshToken(
    user: UserWithCompany,
    meta: { ip?: string; userAgent?: string },
  ): Promise<string> {
    const raw = randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(raw);
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL') || '7d';
    const refreshMs = this.parseDurationMs(refreshTtl, 7 * 86_400_000);
    await this.authRepository.createRefreshToken({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + refreshMs),
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return raw;
  }

  async login(dto: LoginDto, req: Request, res: Response) {
    const meta = this.clientMeta(req);
    const max = Number(this.config.get('RATE_LIMIT_LOGIN_MAX') || 10);
    const windowSec = Number(this.config.get('RATE_LIMIT_LOGIN_WINDOW_SEC') || 60);
    await this.assertRateLimit(`rl:login:${meta.ip || 'unknown'}:${dto.email}`, max, windowSec);

    const user = await this.authRepository.findUserByEmail(dto.email);
    if (!user) {
      throw authError(
        HttpStatus.UNAUTHORIZED,
        'AUTH_INVALID_CREDENTIALS',
        'E-mail ou senha inválidos.',
      );
    }

    if (user.status === UserStatus.INACTIVE || user.status === UserStatus.SUSPENDED) {
      throw authError(
        HttpStatus.FORBIDDEN,
        'AUTH_USER_INACTIVE',
        'Usuário inativo ou suspenso.',
      );
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw authError(
        HttpStatus.UNAUTHORIZED,
        'AUTH_INVALID_CREDENTIALS',
        'E-mail ou senha inválidos.',
      );
    }

    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user, meta);
    this.setAuthCookies(res, accessToken, refreshToken);
    await this.authRepository.updateLastLogin(user.id);
    await this.authRepository.createAuditLog({
      companyId: user.companyId,
      userId: user.id,
      action: 'USER_LOGIN',
      entity: 'USER',
      entityId: user.id,
      metadata: { email: user.email },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { user: this.toPublicUser(user) };
  }

  async refresh(req: Request, res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!raw) {
      throw authError(HttpStatus.UNAUTHORIZED, 'AUTH_TOKEN_INVALID', 'Refresh token inválido.');
    }

    const tokenHash = this.hashToken(raw);
    const stored = await this.authRepository.findRefreshByHash(tokenHash);
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw authError(HttpStatus.UNAUTHORIZED, 'AUTH_TOKEN_INVALID', 'Refresh token inválido.');
    }

    const user = stored.user;
    if (user.status !== UserStatus.ACTIVE) {
      throw authError(
        HttpStatus.FORBIDDEN,
        'AUTH_USER_INACTIVE',
        'Usuário inativo ou suspenso.',
      );
    }

    await this.authRepository.revokeRefreshToken(stored.id);
    const meta = this.clientMeta(req);
    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user, meta);
    this.setAuthCookies(res, accessToken, refreshToken);
    return { ok: true };
  }

  async logout(req: Request, res: Response, user?: AuthUser) {
    const meta = this.clientMeta(req);
    const refreshRaw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    let userId = user?.id;
    let companyId = user?.companyId ?? null;

    if (refreshRaw) {
      const stored = await this.authRepository.findRefreshByHash(this.hashToken(refreshRaw));
      if (stored) {
        if (!stored.revokedAt) {
          await this.authRepository.revokeRefreshToken(stored.id);
        }
        userId = userId || stored.userId;
        companyId = companyId || stored.user.companyId;
      }
    }

    if (!userId) {
      const accessRaw = req.cookies?.[ACCESS_COOKIE] as string | undefined;
      if (accessRaw) {
        try {
          const payload = this.jwtService.verify<{ sub: string; companyId: string }>(accessRaw, {
            secret: this.config.get<string>('JWT_ACCESS_SECRET'),
          });
          userId = payload.sub;
          companyId = companyId || payload.companyId;
        } catch {
          // access morto: ainda limpa cookies
        }
      }
    }

    if (userId) {
      await this.authRepository.createAuditLog({
        companyId,
        userId,
        action: 'USER_LOGOUT',
        entity: 'USER',
        entityId: userId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    }

    this.clearAuthCookies(res);
    return { ok: true };
  }

  async me(user: AuthUser) {
    const full = await this.authRepository.findUserById(user.id);
    if (!full || full.status !== UserStatus.ACTIVE) {
      throw authError(HttpStatus.UNAUTHORIZED, 'AUTH_UNAUTHORIZED', 'Sessão inválida ou expirada.');
    }
    return { user: this.toPublicUser(full) };
  }

  async forgotPassword(dto: ForgotPasswordDto, req: Request) {
    const meta = this.clientMeta(req);
    const max = Number(this.config.get('RATE_LIMIT_LOGIN_MAX') || 10);
    const windowSec = Number(this.config.get('RATE_LIMIT_LOGIN_WINDOW_SEC') || 60);
    await this.assertRateLimit(`rl:forgot:${meta.ip || 'unknown'}`, max, windowSec);

    const message = 'Se o e-mail existir, enviaremos instruções.';
    const user = await this.authRepository.findUserByEmail(dto.email);
    if (!user) {
      return { message };
    }

    const raw = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(raw);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.authRepository.createPasswordResetToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    });
    await this.authRepository.createAuditLog({
      companyId: user.companyId,
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entity: 'USER',
      entityId: user.id,
      metadata: { email: user.email },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    const resetUrl = `http://localhost:3000/reset-password?token=${raw}`;
    this.logger.log(`[DEV] Password reset URL: ${resetUrl}`);

    return { message };
  }

  async resetPassword(dto: ResetPasswordDto, req: Request) {
    if (dto.password !== dto.passwordConfirmation) {
      throw authError(
        HttpStatus.BAD_REQUEST,
        'AUTH_VALIDATION',
        'As senhas não coincidem.',
      );
    }

    const tokenHash = this.hashToken(dto.token);
    const stored = await this.authRepository.findPasswordResetByHash(tokenHash);
    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw authError(
        HttpStatus.BAD_REQUEST,
        'AUTH_RESET_INVALID',
        'Link de redefinição inválido ou expirado.',
      );
    }

    const rounds = Number(this.config.get('BCRYPT_ROUNDS') || 10);
    const passwordHash = await bcrypt.hash(dto.password, rounds);
    await this.authRepository.updatePasswordHash(stored.userId, passwordHash);
    await this.authRepository.markPasswordResetUsed(stored.id);
    await this.authRepository.revokeAllRefreshTokens(stored.userId);

    const meta = this.clientMeta(req);
    await this.authRepository.createAuditLog({
      companyId: stored.user.companyId,
      userId: stored.userId,
      action: 'PASSWORD_RESET_COMPLETED',
      entity: 'USER',
      entityId: stored.userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { ok: true };
  }

  async changePassword(dto: ChangePasswordDto, user: AuthUser, req: Request, res: Response) {
    if (dto.newPassword !== dto.newPasswordConfirmation) {
      throw authError(
        HttpStatus.BAD_REQUEST,
        'AUTH_VALIDATION',
        'As senhas não coincidem.',
      );
    }

    const full = await this.authRepository.findUserById(user.id);
    if (!full) {
      throw authError(HttpStatus.UNAUTHORIZED, 'AUTH_UNAUTHORIZED', 'Sessão inválida ou expirada.');
    }

    const matches = await bcrypt.compare(dto.currentPassword, full.passwordHash);
    if (!matches) {
      throw authError(
        HttpStatus.UNAUTHORIZED,
        'AUTH_INVALID_CREDENTIALS',
        'Senha atual incorreta.',
      );
    }

    const rounds = Number(this.config.get('BCRYPT_ROUNDS') || 10);
    const passwordHash = await bcrypt.hash(dto.newPassword, rounds);
    await this.authRepository.updatePasswordHash(full.id, passwordHash);
    await this.authRepository.revokeAllRefreshTokens(full.id);

    const meta = this.clientMeta(req);
    await this.authRepository.createAuditLog({
      companyId: full.companyId,
      userId: full.id,
      action: 'PASSWORD_CHANGED',
      entity: 'USER',
      entityId: full.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    this.clearAuthCookies(res);
    return { ok: true, requireLogin: true };
  }
}
