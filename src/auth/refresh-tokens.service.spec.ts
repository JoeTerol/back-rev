import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from './refresh-token.entity';
import { RefreshTokensService } from './refresh-tokens.service';

describe('RefreshTokensService', () => {
  let moduleRef: TestingModule;
  let service: RefreshTokensService;
  let repo: Repository<RefreshToken>;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs',
          entities: [RefreshToken],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([RefreshToken]),
      ],
      providers: [RefreshTokensService],
    }).compile();

    service = moduleRef.get(RefreshTokensService);
    repo = moduleRef.get(getRepositoryToken(RefreshToken));
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('should issue an opaque token and store only its hash', async () => {
    const token = await service.issue('user-1');
    const rows = await repo.find();

    expect(token).toHaveLength(64);
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toBe(token);
  });

  it('should rotate a valid token into a new one', async () => {
    const first = await service.issue('user-1');
    const rotated = await service.rotate(first);

    expect(rotated.userId).toBe('user-1');
    expect(rotated.refreshToken).not.toBe(first);
    await expect(service.rotate(rotated.refreshToken)).resolves.toBeDefined();
  });

  it('should keep the same session family when rotating', async () => {
    const first = await service.issue('user-1');
    await service.rotate(first);

    const rows = await repo.find();

    expect(rows).toHaveLength(2);
    expect(rows[0].familyId).toBe(rows[1].familyId);
  });

  it('should reject an unknown token', async () => {
    await expect(service.rotate('no-existe')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should reject an expired token', async () => {
    const token = await service.issue('user-1');
    await repo.update({ userId: 'user-1' }, { expiresAt: new Date(Date.now() - 1000) });

    await expect(service.rotate(token)).rejects.toThrow(UnauthorizedException);
  });

  it('should detect reuse and close every session of that user', async () => {
    const sessionA = await service.issue('user-1');
    const sessionB = await service.issue('user-1');
    const rotated = await service.rotate(sessionA);

    await expect(service.rotate(sessionA)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.rotate(rotated.refreshToken)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.rotate(sessionB)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should not touch the sessions of other users when reuse is detected', async () => {
    const mine = await service.issue('user-1');
    const other = await service.issue('user-2');

    await service.rotate(mine);
    await expect(service.rotate(mine)).rejects.toThrow(UnauthorizedException);

    await expect(service.rotate(other)).resolves.toBeDefined();
  });

  it('should close only one session on revoke', async () => {
    const sessionA = await service.issue('user-1');
    const sessionB = await service.issue('user-1');

    await service.revoke(sessionA);

    await expect(service.rotate(sessionB)).resolves.toBeDefined();
  });

  it('should reject a token that was revoked', async () => {
    const token = await service.issue('user-1');
    await service.revoke(token);

    await expect(service.rotate(token)).rejects.toThrow(UnauthorizedException);
  });

  it('should ignore an unknown token on revoke', async () => {
    await expect(service.revoke('no-existe')).resolves.toBeUndefined();
  });

  it('should close all sessions of a user', async () => {
    const sessionA = await service.issue('user-1');
    const sessionB = await service.issue('user-1');

    await service.revokeAllForUser('user-1');

    await expect(service.rotate(sessionA)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.rotate(sessionB)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});