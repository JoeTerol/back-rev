import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../src/configure-app';
import { CreateUserDto } from '../src/users/dto/create-user.dto';

@Controller('test-validation')
class TestValidationController {
  @Post()
  echo(@Body() body: CreateUserDto) {
    return body;
  }
}

describe('Validation (e2e)', () => {
  let app: INestApplication;

  const valid = {
    email: 'ana@example.com',
    username: 'ana',
    password: 'secret123',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TestValidationController],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should accept valid data', async () => {
    await request(app.getHttpServer())
      .post('/api/test-validation')
      .send(valid)
      .expect(201);
  });

  it('should answer 400 for invalid data', async () => {
    await request(app.getHttpServer())
      .post('/api/test-validation')
      .send({ ...valid, email: 'malo', password: '123' })
      .expect(400);
  });

  it('should answer 400 when an unknown field like role is sent', async () => {
    await request(app.getHttpServer())
      .post('/api/test-validation')
      .send({ ...valid, role: 'admin' })
      .expect(400);
  });
});
