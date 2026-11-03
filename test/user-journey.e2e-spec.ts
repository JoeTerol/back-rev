import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Role } from '../src/common/roles.enum';
import { configureApp } from '../src/configure-app';
import { ADMIN_SEED } from '../src/users/admin-seeder.service';

type Method = 'get' | 'post' | 'patch';

interface CallOptions {
  token?: string;
  body?: object;
}

describe('User journey (e2e)', () => {
  let app: INestApplication;

  const root = {
    email: 'root@example.com',
    username: 'root',
    password: 'clave-segura-123',
  };

  const ana = {
    email: 'ana@example.com',
    username: 'ana',
    password: 'secret123',
  };

  // Ninguna respuesta puede traer el hash de la contraseña.
  const expectNoSecrets = (body: unknown) => {
    const text = JSON.stringify(body);
    expect(text).not.toContain('passwordHash');
    expect(text).not.toContain('$2');
  };

  const call = async (
    method: Method,
    path: string,
    status: number,
    options: CallOptions = {},
  ) => {
    let req = request(app.getHttpServer())[method](path);
    if (options.token) {
      req = req.set('Authorization', `Bearer ${options.token}`);
    }
    if (options.body) {
      req = req.send(options.body);
    }

    const res = await req.expect(status);
    expectNoSecrets(res.body);
    return res;
  };

  const logIn = async (credentials: { email: string; password: string }) =>
    (
      await call('post', '/api/auth/login', 200, {
        body: { email: credentials.email, password: credentials.password },
      })
    ).body;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ADMIN_SEED)
      .useValue(root)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should follow an account from sign-up to suspension and back', async () => {
    // 1. Ana se registra y entra con el token que recibe.
    const signUp = await call('post', '/api/auth/register', 201, {
      body: ana,
    });
    const session = signUp.body;
    const me = await call('get', '/api/users/me', 200, {
      token: session.accessToken,
    });
    expect(me.body).toMatchObject({ username: 'ana', role: Role.USER });

    // 2. Su perfil público no muestra más que lo necesario.
    const profile = await call('get', '/api/users/public/ana', 200);
    expect(Object.keys(profile.body).sort()).toEqual([
      'createdAt',
      'role',
      'username',
    ]);

    // 3. Siendo usuaria común, no puede tocar la administración.
    await call('patch', `/api/users/${session.user.id}/role`, 403, {
      token: session.accessToken,
      body: { role: Role.ADMIN },
    });

    // 4. El admin inicial entra y la nombra moderadora.
    const admin = await logIn(root);
    expect(admin.user.role).toBe(Role.ADMIN);
    await call('patch', `/api/users/${session.user.id}/role`, 200, {
      token: admin.accessToken,
      body: { role: Role.MODERATOR },
    });

    // 5. El cambio rige ya mismo, con el mismo token que Ana tenía.
    const promoted = await call('get', '/api/users/me', 200, {
      token: session.accessToken,
    });
    expect(promoted.body.role).toBe(Role.MODERATOR);

    // 6. Ana renueva su sesión y la cierra; ese refresh token ya no sirve.
    const renewed = await call('post', '/api/auth/refresh', 200, {
      body: { refreshToken: session.refreshToken },
    });
    await call('post', '/api/auth/logout', 204, {
      body: { refreshToken: renewed.body.refreshToken },
    });
    await call('post', '/api/auth/refresh', 401, {
      body: { refreshToken: renewed.body.refreshToken },
    });

    // 7. Vuelve a entrar y el admin la suspende: queda afuera de inmediato.
    const second = await logIn(ana);
    await call('post', `/api/users/${session.user.id}/ban`, 200, {
      token: admin.accessToken,
    });
    const blocked = await call('get', '/api/users/me', 403, {
      token: second.accessToken,
    });
    expect(blocked.body.message).toBe('Cuenta suspendida');
    await call('post', '/api/auth/login', 403, {
      body: { email: ana.email, password: ana.password },
    });

    // 8. El admin la reactiva y conserva el rol que tenía.
    await call('post', `/api/users/${session.user.id}/unban`, 200, {
      token: admin.accessToken,
    });
    const back = await logIn(ana);
    const finalMe = await call('get', '/api/users/me', 200, {
      token: back.accessToken,
    });
    expect(finalMe.body.role).toBe(Role.MODERATOR);
  }, 30000);
});