import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Role } from '../src/common/roles.enum';
import { configureApp } from '../src/configure-app';
import { User } from '../src/users/user.entity';

interface Account {
  id: string;
  token: string;
}

describe('Roles (e2e)', () => {
  let app: INestApplication;
  let admin: Account;
  let regular: Account;

  const register = async (username: string): Promise<Account> => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `${username}@example.com`,
        username,
        password: 'secret123',
      })
      .expect(201);

    return { id: res.body.user.id, token: res.body.accessToken };
  };

  const changeRole = (id: string, token: string | null, role: string) => {
    const req = request(app.getHttpServer())
      .patch(`/api/users/${id}/role`)
      .send({ role });

    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    admin = await register('admin1');
    regular = await register('ana');

    // Todavía no existe un admin: este se ascendió directo en la base solo para el test.
    await app
      .get(DataSource)
      .getRepository(User)
      .update(admin.id, { role: Role.ADMIN });
  });

  afterEach(async () => {
    await app.close();
  });

  it('should let an admin change the role of another user', async () => {
    const res = await changeRole(regular.id, admin.token, 'editor').expect(200);

    expect(res.body.role).toBe('editor');

    const profile = await request(app.getHttpServer())
      .get('/api/users/public/ana')
      .expect(200);

    expect(profile.body.role).toBe('editor');
  });

  it('should not let a regular user promote themselves', async () => {
    await changeRole(regular.id, regular.token, 'admin').expect(403);

    const me = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${regular.token}`)
      .expect(200);

    expect(me.body.role).toBe('user');
  });

  it('should answer 401 without a token', async () => {
    await changeRole(regular.id, null, 'editor').expect(401);
  });

  it('should answer 400 for a role that does not exist', async () => {
    await changeRole(regular.id, admin.token, 'superuser').expect(400);
  });

  it('should answer 404 for an unknown user', async () => {
    await changeRole(
      '3f2b7a52-9d3e-4c6a-8b1f-5e7d2c9a1b44',
      admin.token,
      'editor',
    ).expect(404);
  });

  it('should not let an admin change their own role', async () => {
    await changeRole(admin.id, admin.token, 'user').expect(400);
  });

  it('should answer 400 for an id that is not a UUID', async () => {
    await changeRole('no-es-un-uuid', admin.token, 'editor').expect(400);
  });
});