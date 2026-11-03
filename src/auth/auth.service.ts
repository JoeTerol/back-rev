import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokensService } from './refresh-tokens.service';

@Injectable()
export class AuthService {
  // Hash de relleno: si el email no existe, se compara contra este para que la
  // respuesta tarde lo mismo y no delate qué emails están registrados.
  private readonly dummyHash = bcrypt.hashSync('relleno-no-es-una-clave', 10);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly refreshTokens: RefreshTokensService,
  ) {}

  async register(dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    return this.startSession(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    const passwordOk = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? this.dummyHash,
    );

    if (!user || !passwordOk) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.startSession(user);
  }

  async refresh(refreshToken: string) {
    const rotated = await this.refreshTokens.rotate(refreshToken);

    const user = await this.usersService.findById(rotated.userId);
    if (!user) {
      await this.refreshTokens.revokeAllForUser(rotated.userId);
      throw new UnauthorizedException('Sesión inválida');
    }

    return {
      accessToken: await this.signAccessToken(user),
      refreshToken: rotated.refreshToken,
      user: this.toView(user),
    };
  }

  logout(refreshToken: string): Promise<void> {
    return this.refreshTokens.revoke(refreshToken);
  }

  logoutAll(userId: string): Promise<void> {
    return this.refreshTokens.revokeAllForUser(userId);
  }

  private async startSession(user: User) {
    return {
      accessToken: await this.signAccessToken(user),
      refreshToken: await this.refreshTokens.issue(user.id),
      user: this.toView(user),
    };
  }

  private signAccessToken(user: User): Promise<string> {
    return this.jwtService.signAsync({ sub: user.id });
  }

  private toView(user: User) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };
  }
}