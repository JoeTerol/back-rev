import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { RefreshToken } from './refresh-token.entity';

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

@Injectable()
export class RefreshTokensService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly tokens: Repository<RefreshToken>,
  ) {}

  /** Crea un token nuevo y lo devuelve en texto plano (es la única vez que existe así). */
  async issue(userId: string, familyId: string = randomUUID()): Promise<string> {
    const token = randomBytes(48).toString('base64url');

    await this.tokens.save(
      this.tokens.create({
        userId,
        familyId,
        tokenHash: this.hash(token),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      }),
    );

    return token;
  }

  /** Canjea un token válido por uno nuevo de la misma sesión. */
  async rotate(token: string): Promise<{ userId: string; refreshToken: string }> {
    const stored = await this.tokens.findOneBy({ tokenHash: this.hash(token) });
    if (!stored) {
      throw new UnauthorizedException('Sesión inválida');
    }

    if (stored.revoked) {
      // Un token ya canjeado volvió a usarse: puede estar robado. Se cierran todas las sesiones.
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Sesión inválida');
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Sesión inválida');
    }

    stored.revoked = true;
    await this.tokens.save(stored);

    return {
      userId: stored.userId,
      refreshToken: await this.issue(stored.userId, stored.familyId),
    };
  }

  /** Cierra la sesión a la que pertenece el token (logout). Si no existe, no hace nada. */
  async revoke(token: string): Promise<void> {
    const stored = await this.tokens.findOneBy({ tokenHash: this.hash(token) });
    if (stored) {
      await this.tokens.update(
        { familyId: stored.familyId, revoked: false },
        { revoked: true },
      );
    }
  }

  /** Cierra todas las sesiones de un usuario. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.tokens.update({ userId, revoked: false }, { revoked: true });
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}