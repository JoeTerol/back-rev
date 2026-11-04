import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Role } from '../src/common/roles.enum';
import { configureApp } from '../src/configure-app';
import { IssuePage } from '../src/issues/issue-page.entity';
import { IssueStatus } from '../src/issues/issue-status.enum';
import { Issue } from '../src/issues/issue.entity';
import { User } from '../src/users/user.entity';
import { UsersService } from '../src/users/users.service';

describe('Premium issues (e2e)', () => {
  let app: INestApplication;
  let issues: Repository<Issue>;
  let pages: Repository<IssuePage>;
  let users: Repository<User>;
  let editorToken: string;

  const names = ['A', 'B', 'C', 'D', 'E', 'F'];

  const createIssue = (body: object) =>
    request(app.getHttpServer())
      .post('/api/admin/issues')
      .set('Authorization', `Bearer ${editorToken}`)
      .send(body);

  const editIssue = (id: string, body: object) =>
    request(app.getHttpServer())
      .patch(`/api/admin/issues/${id}`)
      .set('Authorization', `Bearer ${editorToken}`)
      .send(body);

  // Edición publicada con 6 páginas (A…F). Las tres últimas llevan un dato
  // "secreto" para comprobar que no se filtra en la vista previa.
  const seedPublished = async (slug: string, isPremium: boolean) => {
    const issue = await issues.save(
      issues.create({
        title: `Edición ${slug}`,
        slug,
        status: IssueStatus.PUBLISHED,
        isPremium,
      }),
    );
    await pages.save(
      names.map((name, index) =>
        pages.create({
          issueId: issue.id,
          pageNumber: index + 1,
          data: index < 3 ? { name } : { name, secret: 'solo-premium' },
        }),
      ),
    );
    return issue;
  };

  const register = async (
    username: string,
    premiumUntil: Date | null = null,
  ) => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `${username}@example.com`,
        username,
        password: 'secret123',
      })
      .expect(201);
    if (premiumUntil) {
      await users.update({ id: res.body.user.id }, { premiumUntil });
    }
    return {
      id: res.body.user.id as string,
      token: res.body.accessToken as string,
    };
  };

  const read = (slug: string, token?: string) => {
    const req = request(app.getHttpServer()).get(`/api/issues/${slug}`);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  const pageNames = (body: { pages: { data: { name: string } }[] }) =>
    body.pages.map((page) => page.data.name);

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    issues = app.get(getRepositoryToken(Issue));
    pages = app.get(getRepositoryToken(IssuePage));
    users = app.get(getRepositoryToken(User));

    const editor = await register('editor');
    await app.get(UsersService).updateRole(editor.id, Role.EDITOR);
    editorToken = editor.token;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('marking an issue as premium', () => {
    it('should let the editor create a premium issue', async () => {
      const res = await createIssue({
        title: 'Edición de lujo',
        isPremium: true,
      }).expect(201);

      expect(res.body.isPremium).toBe(true);
    });

    it('should create free issues by default', async () => {
      const res = await createIssue({ title: 'Edición común' }).expect(201);

      expect(res.body.isPremium).toBe(false);
    });

    it('should let the editor switch an issue between free and premium', async () => {
      const created = (await createIssue({ title: 'Edición común' }).expect(201))
        .body;

      const premium = await editIssue(created.id, { isPremium: true }).expect(
        200,
      );
      const titleOnly = await editIssue(created.id, {
        title: 'Otro título',
      }).expect(200);
      const free = await editIssue(created.id, { isPremium: false }).expect(
        200,
      );

      expect(premium.body.isPremium).toBe(true);
      expect(titleOnly.body.isPremium).toBe(true);
      expect(free.body.isPremium).toBe(false);
    });

    it('should refuse a premium flag that is not a boolean', async () => {
      const res = await createIssue({
        title: 'Edición común',
        isPremium: 'si',
      }).expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining(['isPremium must be a boolean value']),
      );
    });
  });

  it('should tell in the public list which issues are premium', async () => {
    await seedPublished('agosto-2026', false);
    await seedPublished('octubre-2026', true);

    const res = await request(app.getHttpServer())
      .get('/api/issues')
      .expect(200);

    const bySlug = Object.fromEntries(
      res.body.map((issue: { slug: string; isPremium: boolean }) => [
        issue.slug,
        issue.isPremium,
      ]),
    );
    expect(bySlug).toEqual({ 'agosto-2026': false, 'octubre-2026': true });
  });

  describe('reading an issue', () => {
    it('should show a free issue in full to a visitor', async () => {
      await seedPublished('agosto-2026', false);

      const res = await read('agosto-2026').expect(200);

      expect(pageNames(res.body)).toEqual(names);
      expect(res.body).toMatchObject({
        isPremium: false,
        locked: false,
        totalPages: 6,
      });
    });

    it('should show only the preview of a premium issue to a visitor', async () => {
      await seedPublished('octubre-2026', true);

      const res = await read('octubre-2026').expect(200);

      expect(pageNames(res.body)).toEqual(['A', 'B', 'C']);
      expect(res.body).toMatchObject({
        isPremium: true,
        locked: true,
        totalPages: 6,
      });
      expect(JSON.stringify(res.body)).not.toContain('solo-premium');
    });

    it('should show only the preview to a logged-in reader without premium', async () => {
      await seedPublished('octubre-2026', true);
      const ana = await register('ana');

      const res = await read('octubre-2026', ana.token).expect(200);

      expect(pageNames(res.body)).toEqual(['A', 'B', 'C']);
      expect(res.body.locked).toBe(true);
    });

    it('should show the whole premium issue to a reader with premium', async () => {
      await seedPublished('octubre-2026', true);
      const bruno = await register(
        'bruno',
        new Date('2099-12-31T03:00:00.000Z'),
      );

      const res = await read('octubre-2026', bruno.token).expect(200);

      expect(pageNames(res.body)).toEqual(names);
      expect(res.body).toMatchObject({ locked: false, totalPages: 6 });
    });

    it('should show only the preview once the premium has expired', async () => {
      await seedPublished('octubre-2026', true);
      const carla = await register(
        'carla',
        new Date('2020-01-01T00:00:00.000Z'),
      );

      const res = await read('octubre-2026', carla.token).expect(200);

      expect(pageNames(res.body)).toEqual(['A', 'B', 'C']);
      expect(res.body.locked).toBe(true);
    });

    it('should answer 401 when the token is not valid, even on a free issue', async () => {
      await seedPublished('agosto-2026', false);

      await read('agosto-2026', 'esto-no-es-un-token').expect(401);
    });

    it('should answer 401 when the token has expired', async () => {
      await seedPublished('agosto-2026', false);
      const dani = await register('dani');
      const expired = await app
        .get(JwtService)
        .signAsync({ sub: dani.id }, { expiresIn: -10 });

      await read('agosto-2026', expired).expect(401);
    });

    it('should refuse a suspended account even on a free issue', async () => {
      await seedPublished('agosto-2026', false);
      const eli = await register('eli');
      await users.update({ id: eli.id }, { banned: true });

      await read('agosto-2026', eli.token).expect(403);
    });
  });
});