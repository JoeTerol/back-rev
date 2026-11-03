                  import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

interface Session {
  accessToken: string;
  refreshToken: string;
}

describe('Auth refresh and logout (e2e)', () => {
  let app: INestApplication;
  let first: Session;

  const credentials = { email: 'ana@example.com', password: 'secret123' };

  const post = (path: string) => request(app.getHttpServer()).post(path);

  const refresh = (refreshToken: string) =>
    post('/api/auth/refresh').send({ refreshToken });

  const logout = (refreshToken: string) =>
    post('/api/auth/logout').send({ refreshToken });

  const logIn = async (): Promise<Session> => {
    const res = await post('/api/auth/login').send(credentials).expect(200);
    return res.body;
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    const res = await post('/api/auth/register')
      .send({ ...credentials, username: 'ana' })
      .expect(201);
    first = res.body;
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return a refresh token on register and on login', async () => {
    const second = await logIn();

    expect(first.refreshToken).toEqual(expect.any(String));
    expect(second.refreshToken).toEqual(expect.any(String));
    expect(second.refreshToken).not.toBe(first.refreshToken);
  });

  it('should exchange a refresh token for a new pair', async () => {
    const res = await refresh(first.refreshToken).expect(200);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).not.toBe(first.refreshToken);
    expect(res.body.user.username).toBe('ana');

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .expect(200);
  });

  it('should not accept a refresh token that was already used', async () => {
    await refresh(first.refreshToken).expect(200);

    await refresh(first.refreshToken).expect(401);
  });

  it('should close every session when an old token is reused', async () => {
    const second = await logIn();
    const rotated = (await refresh(first.refreshToken).expect(200)).body;

    await refresh(first.refreshToken).expect(401);

    await refresh(rotated.refreshToken).expect(401);
    await refresh(second.refreshToken).expect(401);
  });

  it('should answer 401 for an unknown refresh token', async () => {
    await refresh('no-existe').expect(401);
  });

  it('should answer 400 when the refresh token is missing', async () => {
    await post('/api/auth/refresh').send({}).expect(400);
  });

  it('should close the session on logout', async () => {
    await logout(first.refreshToken).expect(204);

    await refresh(first.refreshToken).expect(401);
  });

  it('should answer 204 on logout even with an unknown token', async () => {
    await logout('no-existe').expect(204);
  });

  it('should only close the session that logged out', async () => {
    const second = await logIn();

    await logout(first.refreshToken).expect(204);

    await refresh(second.refreshToken).expect(200);
  });

  it('should close every session on logout-all', async () => {
    const second = await logIn();

    await post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .expect(204);

    await refresh(first.refreshToken).expect(401);
    await refresh(second.refreshToken).expect(401);
  });

  it('should require a token for logout-all', async () => {
    await post('/api/auth/logout-all').expect(401);
  });
});