import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let moduleRef: TestingModule;
  let service: UsersService;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs',
          entities: [User],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([User]),
      ],
      providers: [UsersService],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('should store the password encrypted', async () => {
    await service.create({
      email: 'ana@example.com',
      username: 'ana',
      password: 'secret123',
    });

    const user = await service.findByEmailWithPassword('ana@example.com');

    expect(user?.passwordHash).not.toBe('secret123');
    expect(await bcrypt.compare('secret123', user?.passwordHash ?? '')).toBe(true);
  });
});