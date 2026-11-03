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
      throw new UnauthorizedException();
    }

    let userId: string;
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(
        token,
        { algorithms: ['HS256'] },
      );
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    request.user = user;
    return true;
  }

  private extractToken(request: AuthenticatedRequest): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' && token ? token : null;
  }
}