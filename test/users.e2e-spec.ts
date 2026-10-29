import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { UsersService } from '../src/users/users.service';

describe('Users (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    await app.get(UsersService).create({
      email: 'ana@example.com',
      username: 'ana',
      password: 'secret123',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return the public profile of a user', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users/public/ana')
      .expect(200);

    expect(res.body.username).toBe('ana');
    expect(res.body.role).toBe('user');
  });

  it('should not expose private data', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users/public/ana')
      .expect(200);

    expect(res.body).not.toHaveProperty('email');
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('should answer 404 for an unknown user', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users/public/nadie')
      .expect(404);

    expect(res.body.message).toBe('Usuario no encontrado');
  });
});
