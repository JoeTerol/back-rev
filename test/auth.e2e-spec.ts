import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

describe('Auth register (e2e)', () => {
  let app: INestApplication;

  const newUser = {
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
  });

  afterEach(async () => {
    await app.close();
  });

  it('should register a new user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(newUser)
      .expect(201);

    expect(res.body.username).toBe('ana');
    expect(res.body.email).toBe('ana@example.com');
    expect(res.body.role).toBe('user');
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('should make the new user visible in the public profile', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(newUser)
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/users/public/ana')
      .expect(200);

    expect(res.body.username).toBe('ana');
  });

  it('should answer 409 when the email is already registered', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(newUser)
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ ...newUser, username: 'ana2' })
      .expect(409);
  });

  it('should answer 400 for invalid data', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ ...newUser, password: '123' })
      .expect(400);
  });

  it('should not allow choosing a role', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ ...newUser, role: 'admin' })
      .expect(400);
  });
});