import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Role } from '../src/common/roles.enum';
import { configureApp } from '../src/configure-app';
import { User } from '../src/users/user.entity';
import { UsersService } from '../src/users/users.service';

const UNKNOWN_ID = '3f2b8c1e-5d4a-4e7b-9c6f-1a2b3c4d5e6f';

interface Account {
  id: string;
  token: string;
}

describe('User premium (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  let admin: Account;
  let editor: Account;
  let luis: Account;

  const register = async (
    username: string,
    role?: Role,
  ): Promise<Account> => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `${username}@example.com`,
        username,
        password: 'secret123',
      })
      .expect(201);
    if (role) {
      await app.get(UsersService).updateRole(res.body.user.id, role);
    }
    return { id: res.body.user.id, token: res.body.accessToken };
  };

  const grant = (id: string, token: string | undefined, body: object) => {
    const req = request(app.getHttpServer()).put(`/api/users/${id}/premium`);
    return (token ? req.set('Authorization', `Bearer ${token}`) : req).send(
      body,
    );
  };

  const revoke = (id: string, token?: string) => {
    const req = request(app.getHttpServer()).delete(
      `/api/users/${id}/premium`,
    );
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  const me = (token: string) =>
    request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    users = app.get(getRepositoryToken(User));
    admin = await register('jefa', Role.ADMIN);
    editor = await register('editor', Role.EDITOR);
    luis = await register('luis');
  });

  afterEach(async () => {
    await app.close();
  });

  describe('granting premium', () => {
    it('should give premium until the end of the chosen day in Argentina', async () => {
      const res = await grant(luis.id, admin.token, {
        until: '2099-12-31',
      }).expect(200);

      expect(res.body).toEqual({
        id: luis.id,
        username: 'luis',
        premiumUntil: '2100-01-01T03:00:00.000Z',
        isPremium: true,
      });
    });

    it('should show the premium in the user own profile', async () => {
      await grant(luis.id, admin.token, { until: '2099-12-31' }).expect(200);

      const res = await me(luis.token).expect(200);

      expect(res.body).toMatchObject({
        premiumUntil: '2100-01-01T03:00:00.000Z',
        isPremium: true,
      });
    });

    it('should show no premium by default', async () => {
      const res = await me(luis.token).expect(200);

      expect(res.body).toMatchObject({ premiumUntil: null, isPremium: false });
    });

    it('should let the admin change the date to an earlier one', async () => {
      await grant(luis.id, admin.token, { until: '2099-12-31' }).expect(200);

      const res = await grant(luis.id, admin.token, {
        until: '2098-06-30',
      }).expect(200);

      expect(res.body.premiumUntil).toBe('2098-07-01T03:00:00.000Z');
    });

    it('should show no premium once the date has passed', async () => {
      await users.update(
        { id: luis.id },
        { premiumUntil: new Date('2020-01-01T00:00:00.000Z') },
      );

      const res = await me(luis.token).expect(200);

      expect(res.body).toMatchObject({
        premiumUntil: '2020-01-01T00:00:00.000Z',
        isPremium: false,
      });
    });

    it('should refuse a date that has already passed', async () => {
      const res = await grant(luis.id, admin.token, {
        until: '2020-01-01',
      }).expect(400);

      expect(res.body.message).toBe('La fecha de vencimiento ya pasó');
    });

    it.each([
      '2027-1-1',
      '31-12-2027',
      '2027-02-30',
      'mañana',
      '2027-12-31T10:00:00Z',
    ])('should refuse the date %j', async (until) => {
      const res = await grant(luis.id, admin.token, { until }).expect(400);

      expect(res.body.message).toBe(
        'La fecha tiene que tener formato AAAA-MM-DD, por ejemplo 2027-12-31',
      );
    });

    it('should refuse a body without the date', async () => {
      const res = await grant(luis.id, admin.token, {}).expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining(['until must be a string']),
      );
    });
  });

  describe('taking premium away', () => {
    it('should remove the premium', async () => {
      await grant(luis.id, admin.token, { until: '2099-12-31' }).expect(200);

      const res = await revoke(luis.id, admin.token).expect(200);
      const profile = await me(luis.token).expect(200);

      expect(res.body).toEqual({
        id: luis.id,
        username: 'luis',
        premiumUntil: null,
        isPremium: false,
      });
      expect(profile.body).toMatchObject({
        premiumUntil: null,
        isPremium: false,
      });
    });
  });

  describe('wrong ids', () => {
    it('should answer 404 when granting to a user that does not exist', async () => {
      const res = await grant(UNKNOWN_ID, admin.token, {
        until: '2099-12-31',
      }).expect(404);

      expect(res.body.message).toBe('Usuario no encontrado');
    });

    it('should answer 404 when removing from a user that does not exist', async () => {
      const res = await revoke(UNKNOWN_ID, admin.token).expect(404);

      expect(res.body.message).toBe('Usuario no encontrado');
    });

    it('should answer 400 when granting with an id that is not a UUID', async () => {
      const res = await grant('no-es-un-uuid', admin.token, {
        until: '2099-12-31',
      }).expect(400);

      expect(res.body.message).toContain('uuid');
    });

    it('should answer 400 when removing with an id that is not a UUID', async () => {
      const res = await revoke('no-es-un-uuid', admin.token).expect(400);

      expect(res.body.message).toContain('uuid');
    });
  });

  describe('who can do it', () => {
    const forbidden: Array<['luis' | 'editor', 'put' | 'delete']> = [
      ['luis', 'put'],
      ['editor', 'put'],
      ['luis', 'delete'],
      ['editor', 'delete'],
    ];

    it.each(forbidden)('should answer 403 to %s on %s', async (who, verb) => {
      const token = who === 'luis' ? luis.token : editor.token;

      if (verb === 'put') {
        await grant(luis.id, token, { until: '2099-12-31' }).expect(403);
      } else {
        await revoke(luis.id, token).expect(403);
      }

      const stored = await users.findOneBy({ id: luis.id });
      expect(stored?.premiumUntil).toBeNull();
    });

    it('should answer 401 without a token when granting', async () => {
      await grant(luis.id, undefined, { until: '2099-12-31' }).expect(401);
    });

    it('should answer 401 without a token when removing', async () => {
      await revoke(luis.id).expect(401);
    });
  });

  it('should not show the premium in the public profile', async () => {
    await grant(luis.id, admin.token, { until: '2099-12-31' }).expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/users/public/luis')
      .set('Authorization', `Bearer ${luis.token}`)
      .expect(200);

    expect(Object.keys(res.body).sort()).toEqual([
      'createdAt',
      'role',
      'username',
    ]);
  });
});