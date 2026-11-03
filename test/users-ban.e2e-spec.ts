import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Role } from '../src/common/roles.enum';
import { configureApp } from '../src/configure-app';
import { UsersService } from '../src/users/users.service';

interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; username: string };
}

describe('Account suspension (e2e)', () => {
  let app: INestApplication;
  let admin: Session;
  let ana: Session;

  const password = 'secret123';

  const post = (path: string) => request(app.getHttpServer()).post(path);

  const bearer = (session: Session) => `Bearer ${session.accessToken}`;

  const register = async (username: string): Promise<Session> => {
    const res = await post('/api/auth/register')
      .send({ email: `${username}@example.com`, username, password })
      .expect(201);
    return res.body;
  };

  const registerAdmin = async (username: string): Promise<Session> => {
    const session = await register(username);
    await app.get(UsersService).updateRole(session.user.id, Role.ADMIN);
    return session;
  };

  const suspend = (by: Session, id: string) =>
    post(`/api/users/${id}/ban`).set('Authorization', bearer(by));

  const reinstate = (by: Session, id: string) =>
    post(`/api/users/${id}/unban`).set('Authorization', bearer(by));

  const logIn = (email: string, pass: string) =>
    post('/api/auth/login').send({ email, password: pass });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    admin = await registerAdmin('root');
    ana = await register('ana');
  });

  afterEach(async () => {
    await app.close();
  });

  it('should let an admin suspend an account', async () => {
    const res = await suspend(admin, ana.user.id).expect(200);

    expect(res.body).toEqual({
      id: ana.user.id,
      username: 'ana',
      banned: true,
    });
  });

  it('should reject an access token issued before the suspension', async () => {
    await suspend(admin, ana.user.id).expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', bearer(ana))
      .expect(403);

    expect(res.body.message).toBe('Cuenta suspendida');
  });

  it('should not let a suspended account log in', async () => {
    await suspend(admin, ana.user.id).expect(200);

    const res = await logIn('ana@example.com', password).expect(403);

    expect(res.body.message).toBe('Cuenta suspendida');
  });

  it('should not reveal the suspension to a wrong password', async () => {
    await suspend(admin, ana.user.id).expect(200);

    await logIn('ana@example.com', 'otra-clave-123').expect(401);
  });

  it('should not let a suspended account refresh its session', async () => {
    await suspend(admin, ana.user.id).expect(200);

    await post('/api/auth/refresh')
      .send({ refreshToken: ana.refreshToken })
      .expect(403);
  });

  it('should let an admin reinstate an account', async () => {
    await suspend(admin, ana.user.id).expect(200);

    const res = await reinstate(admin, ana.user.id).expect(200);
    expect(res.body.banned).toBe(false);

    const login = await logIn('ana@example.com', password).expect(200);

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
  });

  it.each(['ban', 'unban'])('should forbid %s to non-admins', async (action) => {
    const luis = await register('luis');

    await post(`/api/users/${ana.user.id}/${action}`)
      .set('Authorization', bearer(luis))
      .expect(403);
  });

  it.each(['ban', 'unban'])('should require a token to %s', async (action) => {
    await post(`/api/users/${ana.user.id}/${action}`).expect(401);
  });

  it('should not let an admin suspend themselves', async () => {
    const res = await suspend(admin, admin.user.id).expect(400);

    expect(res.body.message).toBe('No podés suspender tu propia cuenta');
  });

  it('should not let an admin suspend another admin', async () => {
    const boss = await registerAdmin('boss');

    const res = await suspend(admin, boss.user.id).expect(403);

    expect(res.body.message).toBe('No se puede suspender a un administrador');
  });

  it('should answer 404 for an unknown account', async () => {
    const res = await suspend(
      admin,
      '3f2b1c0e-8f0a-4d6e-9b1a-2c7d5e4f6a10',
    ).expect(404);

    expect(res.body.message).toBe('Usuario no encontrado');
  });

  it('should answer 400 when the id is not a UUID', async () => {
    await suspend(admin, 'no-es-un-uuid').expect(400);
  });
});