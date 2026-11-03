import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

describe('GET /users/me (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let userId: string;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'ana@example.com',
        username: 'ana',
        password: 'secret123',
      })
      .expect(201);

    accessToken = res.body.accessToken;
    userId = res.body.user.id;
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return the logged-in user', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.id).toBe(userId);
    expect(res.body.email).toBe('ana@example.com');
    expect(res.body.username).toBe('ana');
    expect(res.body.role).toBe('user');
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('should answer 401 without a token', async () => {
    await request(app.getHttpServer()).get('/api/users/me').expect(401);
  });

  it('should answer 401 with a malformed token', async () => {
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', 'Bearer esto-no-es-un-token')
      .expect(401);
  });

  it('should answer 401 with an expired token', async () => {
    const expired = await app
      .get(JwtService)
      .signAsync({ sub: userId }, { expiresIn: -10 });

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
  });

  it('should answer 401 with a token signed with another secret', async () => {
    const forged = await new JwtService({
      secret: 'x'.repeat(40),
    }).signAsync({ sub: userId });

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${forged}`)
      .expect(401);
  });

  it('should answer 401 when the user no longer exists', async () => {
    const orphan = await app
      .get(JwtService)
      .signAsync({ sub: '00000000-0000-0000-0000-000000000000' });

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${orphan}`)
      .expect(401);
  });

  it('should keep the health endpoint public', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });
});