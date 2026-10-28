import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../common/roles.enum';
import { User } from './user.entity';

describe('User entity', () => {
  let moduleRef: TestingModule;
  let repo: Repository<User>;

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
    }).compile();

    repo = moduleRef.get(getRepositoryToken(User));
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('should save a user with the role "user" by default', async () => {
    await repo.save(
      repo.create({ email: 'ana@example.com', username: 'ana', passwordHash: 'hash' }),
    );

    const found = await repo.findOneByOrFail({ email: 'ana@example.com' });

    expect(found.role).toBe(Role.USER);
  });

  it('should not allow two users with the same email', async () => {
    await repo.save(
      repo.create({ email: 'ana@example.com', username: 'ana', passwordHash: 'hash' }),
    );

    await expect(
      repo.save(
        repo.create({ email: 'ana@example.com', username: 'otra', passwordHash: 'hash' }),
      ),
    ).rejects.toThrow();
  });
});