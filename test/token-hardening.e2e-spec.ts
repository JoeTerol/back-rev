import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

describe('Access token hardening (e2e)', () => {
  let app: INestApplication;
  let userId: string;
  let accessToken: string;

  const base64url = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');

  const sign = (payload: object, options?: { expiresIn: number }) =>
    app.get(JwtService).signAsync(payload, options);

  const me = (authorization: string) =>
    request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', authorization);

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
    userId = res.body.user.id;
    accessToken = res.body.accessToken;
  });

  afterEach(async () => {
    await app.close();
  });

  it('should accept a valid token', async () => {
    await me(`Bearer ${accessToken}`).expect(200);
  });

  it('should reject a token with alg "none"', async () => {
    const forged = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({ sub: userId })}.`;

    await me(`Bearer ${forged}`).expect(401);
  });

  it('should reject a token signed with another secret', async () => {
    const other = new JwtService({ secret: 'otro-secreto-que-no-es-el-de-la-app' });
    const forged = await other.signAsync({ sub: userId });

    await me(`Bearer ${forged}`).expect(401);
  });

  it('should reject an expired token', async () => {
    const expired = await sign({ sub: userId }, { expiresIn: -10 });

    await me(`Bearer ${expired}`).expect(401);
  });

  it('should reject a valid token of an account that does not exist', async () => {
    const orphan = await sign({ sub: randomUUID() });

    await me(`Bearer ${orphan}`).expect(401);
  });

  it('should reject a signed token that has no subject', async () => {
    const anonymous = await sign({});

    await me(`Bearer ${anonymous}`).expect(401);
  });

  it.each(['Bearer', 'Basic dXNlcjpwYXNz', 'Bearer no.es.un.jwt', 'Token abc'])(
    'should reject the malformed header "%s"',
    async (header) => {
      await me(header).expect(401);
    },
  );
});