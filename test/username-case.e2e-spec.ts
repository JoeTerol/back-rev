import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

describe('Usernames are case-insensitive (e2e)', () => {
  let app: INestApplication;

  const register = (username: string, email: string) =>
    request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, username, password: 'secret123' });

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

  it('should reject a username that differs only in capitals', async () => {
    await register('ana', 'ana@example.com').expect(201);

    const res = await register('Ana', 'otra@example.com').expect(409);

    expect(res.body.message).toBe('Ese nombre de usuario ya está en uso');
  });

  it('should reject it the other way around too', async () => {
    await register('ANA', 'ana@example.com').expect(201);

    await register('ana', 'otra@example.com').expect(409);
  });

  it('should keep the capitals the person chose', async () => {
    const res = await register('Ana_Lopez', 'ana@example.com').expect(201);
    expect(res.body.user.username).toBe('Ana_Lopez');

    const me = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .expect(200);

    expect(me.body.username).toBe('Ana_Lopez');
  });

  it('should find a public profile whatever the capitals in the URL', async () => {
    await register('Ana_Lopez', 'ana@example.com').expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/users/public/ANA_LOPEZ')
      .expect(200);

    expect(res.body.username).toBe('Ana_Lopez');
  });
});