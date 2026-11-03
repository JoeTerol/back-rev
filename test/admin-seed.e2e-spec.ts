import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Role } from '../src/common/roles.enum';
import { configureApp } from '../src/configure-app';
import {
  ADMIN_SEED,
  AdminSeeder,
  AdminSeedOptions,
} from '../src/users/admin-seeder.service';
import { UsersService } from '../src/users/users.service';

describe('Initial admin seed (e2e)', () => {
  let app: INestApplication;

  const seed: Required<AdminSeedOptions> = {
    email: 'root@example.com',
    username: 'root',
    password: 'clave-segura-123',
  };

  const startApp = async (options: AdminSeedOptions) => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ADMIN_SEED)
      .useValue(options)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  };

  const logIn = (email: string, password: string) =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });

  afterEach(async () => {
    await app.close();
  });

  it('should create the initial admin on startup', async () => {
    await startApp(seed);

    const res = await logIn(seed.email, seed.password).expect(200);

    expect(res.body.user.role).toBe(Role.ADMIN);
  });

  it('should create nothing when the seed is not configured', async () => {
    await startApp({});

    await logIn(seed.email, seed.password).expect(401);
  });

  it('should be safe to run twice', async () => {
    await startApp(seed);

    await expect(app.get(AdminSeeder).seed()).resolves.toBeUndefined();

    await logIn(seed.email, seed.password).expect(200);
  });

  it('should not promote an account that already exists', async () => {
    await startApp({});
    const users = app.get(UsersService);
    await users.create({
      email: 'ana@example.com',
      username: 'ana',
      password: 'secret123',
    });

    await new AdminSeeder(users, {
      email: 'ana@example.com',
      username: 'ana',
      password: 'clave-segura-123',
    }).seed();

    const ana = await users.findByUsername('ana');
    expect(ana?.role).toBe(Role.USER);
  });

  it('should refuse to start with a weak password', async () => {
    await expect(startApp({ ...seed, password: '123' })).rejects.toThrow(
      'El admin inicial no es válido',
    );
  });

  it('should refuse to start with an email but no password', async () => {
    await expect(startApp({ email: seed.email })).rejects.toThrow(
      'El admin inicial no es válido',
    );
  });
});