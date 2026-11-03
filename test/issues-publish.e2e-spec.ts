import { INestApplication } from '@nestjs/common';
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
import { ADMIN_SEED } from '../src/users/admin-seeder.service';
import { UsersService } from '../src/users/users.service';

type Method = 'post' | 'get' | 'delete';
type Who = 'admin' | 'editor' | 'luis';

describe('Issues, publishing (e2e)', () => {
  let app: INestApplication;
  let issues: Repository<Issue>;
  let pages: Repository<IssuePage>;
  let tokens: Record<Who, string>;

  const root = {
    email: 'root@example.com',
    username: 'root',
    password: 'clave-segura-123',
  };
  const unknownId = '3f2b1c0e-8f0a-4d6e-9b1a-2c7d5e4f6a10';

  const call = (method: Method, path: string, who?: Who) => {
    const req = request(app.getHttpServer())[method](path);
    return who ? req.set('Authorization', `Bearer ${tokens[who]}`) : req;
  };

  const publish = (who: Who, id: string) =>
    call('post', `/api/admin/issues/${id}/publish`, who);

  const unpublish = (who: Who, id: string) =>
    call('post', `/api/admin/issues/${id}/unpublish`, who);

  const registerWithRole = async (username: string, role: Role) => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `${username}@example.com`,
        username,
        password: 'secret123',
      })
      .expect(201);
    await app.get(UsersService).updateRole(res.body.user.id, role);
    return res.body.accessToken as string;
  };

  // Una edición, con una página salvo que se pida lo contrario.
  const seedIssue = async (slug: string, status: IssueStatus, withPage = true) => {
    const issue = await issues.save(
      issues.create({ title: `Edición ${slug}`, slug, status }),
    );
    if (withPage) {
      await pages.save(pages.create({ issueId: issue.id, pageNumber: 1 }));
    }
    return issue;
  };

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

    issues = app.get(getRepositoryToken(Issue));
    pages = app.get(getRepositoryToken(IssuePage));

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: root.email, password: root.password })
      .expect(200);

    tokens = {
      admin: login.body.accessToken,
      editor: await registerWithRole('editor', Role.EDITOR),
      luis: await registerWithRole('luis', Role.USER),
    };
  });

  afterEach(async () => {
    await app.close();
  });

  it.each(['editor', 'admin'] as const)(
    'should let the %s publish an issue that has pages',
    async (who) => {
      const issue = await seedIssue('octubre-2026', IssueStatus.DRAFT);

      const res = await publish(who, issue.id).expect(200);

      expect(res.body).toMatchObject({
        id: issue.id,
        slug: 'octubre-2026',
        status: IssueStatus.PUBLISHED,
      });
    },
  );

  it('should show a published issue to the public', async () => {
    const issue = await seedIssue('octubre-2026', IssueStatus.DRAFT);
    await publish('editor', issue.id).expect(200);

    await call('get', '/api/issues/octubre-2026').expect(200);
    const list = await call('get', '/api/issues').expect(200);

    expect(list.body.map((item: { slug: string }) => item.slug)).toEqual([
      'octubre-2026',
    ]);
  });

  it('should refuse to publish an issue without pages', async () => {
    const issue = await seedIssue('octubre-2026', IssueStatus.DRAFT, false);

    const res = await publish('editor', issue.id).expect(409);

    expect(res.body.message).toBe(
      'No se puede publicar una edición sin páginas',
    );
    const stored = await issues.findOneByOrFail({ id: issue.id });
    expect(stored.status).toBe(IssueStatus.DRAFT);
  });

  it('should hide an issue again when it is unpublished', async () => {
    const issue = await seedIssue('octubre-2026', IssueStatus.PUBLISHED);

    const res = await unpublish('editor', issue.id).expect(200);

    expect(res.body.status).toBe(IssueStatus.DRAFT);
    await call('get', '/api/issues/octubre-2026').expect(404);
  });

  it('should be harmless to publish or unpublish twice', async () => {
    const issue = await seedIssue('octubre-2026', IssueStatus.DRAFT);

    await publish('editor', issue.id).expect(200);
    await publish('editor', issue.id).expect(200);
    await unpublish('editor', issue.id).expect(200);
    await unpublish('editor', issue.id).expect(200);
  });

  it('should not delete a published issue', async () => {
    const issue = await seedIssue('octubre-2026', IssueStatus.PUBLISHED);

    const res = await call(
      'delete',
      `/api/admin/issues/${issue.id}`,
      'editor',
    ).expect(409);

    expect(res.body.message).toBe('Despublicá la edición antes de borrarla');
    expect(await issues.countBy({ id: issue.id })).toBe(1);
  });

  it('should delete an issue once it is unpublished', async () => {
    const issue = await seedIssue('octubre-2026', IssueStatus.PUBLISHED);
    await unpublish('editor', issue.id).expect(200);

    await call('delete', `/api/admin/issues/${issue.id}`, 'editor').expect(204);
  });

  it.each(['publish', 'unpublish'])('should forbid %s to a plain user', async (action) => {
    await call('post', `/api/admin/issues/${unknownId}/${action}`, 'luis').expect(403);
  });

  it.each(['publish', 'unpublish'])('should require a token to %s', async (action) => {
    await call('post', `/api/admin/issues/${unknownId}/${action}`).expect(401);
  });

  it.each(['publish', 'unpublish'])(
    'should answer 404 when trying to %s an unknown issue',
    async (action) => {
      const res = await call(
        'post',
        `/api/admin/issues/${unknownId}/${action}`,
        'editor',
      ).expect(404);

      expect(res.body.message).toBe('Edición no encontrada');
    },
  );

  it('should answer 400 when the id is not a UUID', async () => {
    await call('post', '/api/admin/issues/no-es-un-uuid/publish', 'editor').expect(400);
  });
});