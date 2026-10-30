import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

describe('Auth login (e2e)', () => {
  let app: INestApplication;

  const credentials = {
    email: 'ana@example.com',
    username: 'ana',
    password: 'secret123',
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(credentials)
      .expect(201);
  });

  afterEach(async () => {
    await app.close();
  });

  it('should log in with valid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'ana@example.com', password: 'secret123' })
      .expect(200);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.username).toBe('ana');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('should accept the email in any letter case', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'ANA@Example.com', password: 'secret123' })
      .expect(200);
  });

  it('should answer 401 for a wrong password', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'ana@example.com', password: 'otra-clave-123' })
      .expect(401);

    expect(res.body.message).toBe('Credenciales inválidas');
  });

  it('should answer 401 with the same message for an unknown email', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nadie@example.com', password: 'secret123' })
      .expect(401);

    expect(res.body.message).toBe('Credenciales inválidas');
  });

  it('should answer 400 when the body is incomplete', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'ana@example.com' })
      .expect(400);
  });

  it('should issue a token that expires in 15 minutes', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'ana@example.com', password: 'secret123' })
      .expect(200);

    const payload = JSON.parse(
      Buffer.from(res.body.accessToken.split('.')[1], 'base64url').toString(),
    );

    expect(payload.sub).toBe(res.body.user.id);
    expect(payload.exp - payload.iat).toBe(900);
  });
});