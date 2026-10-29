import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let moduleRef: TestingModule;
  let service: UsersService;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs',
          entities: [User],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([User]),
      ],
      providers: [UsersService],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('should reject a duplicate email with ConflictException', async () => {
    await service.create({
      email: 'ana@example.com',
      username: 'ana',
      password: 'secret123',
    });

    await expect(
      service.create({
        email: 'ana@example.com',
        username: 'ana2',
        password: 'secret123',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should treat emails as case-insensitive', async () => {
    await service.create({
      email: 'Ana@Example.com',
      username: 'ana',
      password: 'secret123',
    });

    const found = await service.findByEmailWithPassword('ANA@example.com');

    expect(found?.email).toBe('ana@example.com');
  });

  it('should reject a duplicate username with ConflictException', async () => {
    await service.create({
      email: 'ana@example.com',
      username: 'ana',
      password: 'secret123',
    });

    await expect(
      service.create({
        email: 'otra@example.com',
        username: 'ana',
        password: 'secret123',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should store the password encrypted', async () => {
    await service.create({
      email: 'ana@example.com',
      username: 'ana',
      password: 'secret123',
    });

    const user = await service.findByEmailWithPassword('ana@example.com');

    expect(user?.passwordHash).not.toBe('secret123');
    expect(await bcrypt.compare('secret123', user?.passwordHash ?? '')).toBe(
      true,
    );
  });

  it('should find a user by id without the password hash', async () => {
    const created = await service.create({
      email: 'ana@example.com',
      username: 'ana',
      password: 'secret123',
    });

    const found = await service.findById(created.id);

    expect(found?.username).toBe('ana');
    expect(found?.passwordHash).toBeUndefined();
  });

  it('should find a user by username', async () => {
    await service.create({
      email: 'ana@example.com',
      username: 'ana',
      password: 'secret123',
    });

    const found = await service.findByUsername('ana');

    expect(found?.email).toBe('ana@example.com');
  });

  it('should return null for an unknown username', async () => {
    expect(await service.findByUsername('nadie')).toBeNull();
  });
});
