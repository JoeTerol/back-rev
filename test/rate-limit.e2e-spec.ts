import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

describe('Rate limiting (e2e)', () => {
  let app: INestApplication;

  const post = (path: string) => request(app.getHttpServer()).post(path);

  const failedLogin = () =>
    post('/api/auth/login').send({
      email: 'nadie@example.com',
      password: 'clave-equivocada',
    });

  const register = (n: number) =>
    post('/api/auth/register').send({
      email: `user${n}@example.com`,
      username: `user${n}`,
      password: 'secret123',
    });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should answer 429 after 10 login attempts in a minute', async () => {
    for (let i = 0; i < 10; i++) {
      await failedLogin().expect(401);
    }

    const res = await failedLogin().expect(429);

    expect(res.headers['retry-after']).toBeDefined();
  }, 20000);

  it('should answer 429 after 5 registrations in an hour', async () => {
    for (let i = 1; i <= 5; i++) {
      await register(i).expect(201);
    }

    await register(6).expect(429);
  }, 20000);

  it('should count each route separately', async () => {
    for (let i = 0; i < 10; i++) {
      await failedLogin().expect(401);
    }
    await failedLogin().expect(429);

    await register(1).expect(201);
  }, 20000);

  it('should answer 429 after 100 requests a minute to the same route', async () => {
    for (let i = 0; i < 100; i++) {
      await request(app.getHttpServer()).get('/api/health').expect(200);
    }

    await request(app.getHttpServer()).get('/api/health').expect(429);
  }, 20000);
});