import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AccountSuspendedException } from './account-suspended.exception';
import { IS_OPTIONAL_AUTH_KEY } from './optional-auth.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';

interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: User;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) {
      // En las rutas con sesión opcional, sin token se atiende como visitante.
      if (this.isOptionalAuth(context)) {
        return true;
      }
      throw new UnauthorizedException();
    }

    const userId = await this.readUserId(token);

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    if (user.banned) {
      throw new AccountSuspendedException();
    }

    request.user = user;
    return true;
  }

  private isOptionalAuth(context: ExecutionContext): boolean {
    return !!this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  }

  private async readUserId(token: string): Promise<string> {
    let payload: { sub?: unknown };
    try {
      payload = await this.jwtService.verifyAsync<{ sub?: unknown }>(token, {
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException();
    }

    // Un token firmado pero sin `sub` no identifica a nadie. Sin esta
    // comprobación, `findById(undefined)` podría buscar sin filtro.
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new UnauthorizedException();
    }
    return payload.sub;
  }

  private extractToken(request: AuthenticatedRequest): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' && token ? token : null;
  }
}