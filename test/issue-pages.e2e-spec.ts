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

type Method = 'post' | 'get' | 'patch' | 'delete';
type Who = 'admin' | 'editor' | 'luis';

describe('Issue pages (e2e)', () => {
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

  const pagesPath = (issueId: string, pageId?: string) =>
    `/api/admin/issues/${issueId}/pages${pageId ? `/${pageId}` : ''}`;

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

  const seedIssue = (slug: string, status = IssueStatus.DRAFT) =>
    issues.save(issues.create({ title: `Edición ${slug}`, slug, status }));

  // Páginas 1..n con data { name } para reconocerlas.
  const seedPages = (issueId: string, names: string[]) =>
    pages.save(
      names.map((name, index) =>
        pages.create({ issueId, pageNumber: index + 1, data: { name } }),
      ),
    );

  // Lo que hay guardado, como [número, nombre], directo desde la base.
  const stored = async (issueId: string) => {
    const found = await pages.find({
      where: { issueId },
      order: { pageNumber: 'ASC' },
    });
    return found.map((page) => [page.pageNumber, page.data.name]);
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

  it('should append pages at the end', async () => {
    const issue = await seedIssue('octubre-2026');

    const first = await call('post', pagesPath(issue.id), 'editor')
      .send({ data: { name: 'A' } })
      .expect(201);
    const second = await call('post', pagesPath(issue.id), 'editor')
      .send({ data: { name: 'B' } })
      .expect(201);

    expect(first.body).toMatchObject({ pageNumber: 1, data: { name: 'A' } });
    expect(second.body.pageNumber).toBe(2);
    expect(await stored(issue.id)).toEqual([
      [1, 'A'],
      [2, 'B'],
    ]);
  });

  it('should default the data to an empty object', async () => {
    const issue = await seedIssue('octubre-2026');

    const res = await call('post', pagesPath(issue.id), 'editor')
      .send({})
      .expect(201);

    expect(res.body.data).toEqual({});
  });

  it.each(['hola', [1, 2]])(
    'should refuse data that is not an object: %j',
    async (data) => {
      const issue = await seedIssue('octubre-2026');

      await call('post', pagesPath(issue.id), 'editor')
        .send({ data })
        .expect(400);
    },
  );

  it('should list the pages in order with only the fields needed', async () => {
    const issue = await seedIssue('octubre-2026');
    await seedPages(issue.id, ['A', 'B', 'C']);

    const res = await call('get', pagesPath(issue.id), 'editor').expect(200);

    expect(
      res.body.map((page: { data: { name: string } }) => page.data.name),
    ).toEqual(['A', 'B', 'C']);
    expect(Object.keys(res.body[0]).sort()).toEqual([
      'data',
      'id',
      'pageNumber',
    ]);
  });

  it('should edit the data of a page', async () => {
    const issue = await seedIssue('octubre-2026');
    const [page] = await seedPages(issue.id, ['A']);

    const res = await call('patch', pagesPath(issue.id, page.id), 'editor')
      .send({ data: { name: 'A corregida' } })
      .expect(200);

    expect(res.body.data).toEqual({ name: 'A corregida' });
    expect(await stored(issue.id)).toEqual([[1, 'A corregida']]);
  });

  it('should not let the page number be set directly', async () => {
    const issue = await seedIssue('octubre-2026');
    const [page] = await seedPages(issue.id, ['A']);

    await call('patch', pagesPath(issue.id, page.id), 'editor')
      .send({ pageNumber: 9 })
      .expect(400);

    expect(await stored(issue.id)).toEqual([[1, 'A']]);
  });

  it('should delete a page and close the gap', async () => {
    const issue = await seedIssue('octubre-2026');
    const [, second] = await seedPages(issue.id, ['A', 'B', 'C']);

    await call('delete', pagesPath(issue.id, second.id), 'editor').expect(204);

    expect(await stored(issue.id)).toEqual([
      [1, 'A'],
      [2, 'C'],
    ]);
  });

  it('should not delete the last page of a published issue', async () => {
    const issue = await seedIssue('octubre-2026', IssueStatus.PUBLISHED);
    const [page] = await seedPages(issue.id, ['A']);

    const res = await call('delete', pagesPath(issue.id, page.id), 'editor').expect(
      409,
    );

    expect(res.body.message).toBe(
      'No se puede borrar la última página de una edición publicada. Despublicala primero',
    );
    expect(await stored(issue.id)).toEqual([[1, 'A']]);
  });

  it('should delete a page of a published issue while others remain', async () => {
    const issue = await seedIssue('octubre-2026', IssueStatus.PUBLISHED);
    const [first] = await seedPages(issue.id, ['A', 'B']);

    await call('delete', pagesPath(issue.id, first.id), 'editor').expect(204);

    expect(await stored(issue.id)).toEqual([[1, 'B']]);
  });

  it('should let a draft lose its last page', async () => {
    const issue = await seedIssue('octubre-2026');
    const [page] = await seedPages(issue.id, ['A']);

    await call('delete', pagesPath(issue.id, page.id), 'editor').expect(204);

    expect(await stored(issue.id)).toEqual([]);
  });

  it('should show the pages publicly once the issue is published', async () => {
    const issue = await seedIssue('octubre-2026');
    await call('post', pagesPath(issue.id), 'editor')
      .send({ data: { name: 'A' } })
      .expect(201);
    await call('post', pagesPath(issue.id), 'editor')
      .send({ data: { name: 'B' } })
      .expect(201);
    await call('post', `/api/admin/issues/${issue.id}/publish`, 'editor').expect(
      200,
    );

    const res = await call('get', '/api/issues/octubre-2026').expect(200);

    expect(
      res.body.pages.map((page: { data: { name: string } }) => page.data.name),
    ).toEqual(['A', 'B']);
  });

  it('should answer 404 when adding a page to an unknown issue', async () => {
    const res = await call('post', pagesPath(unknownId), 'editor')
      .send({ data: { name: 'A' } })
      .expect(404);

    expect(res.body.message).toBe('Edición no encontrada');
  });

  it.each(['patch', 'delete'] as const)(
    'should answer 404 on %s for a page of another issue',
    async (method) => {
      const august = await seedIssue('agosto-2026');
      const september = await seedIssue('septiembre-2026');
      const [page] = await seedPages(august.id, ['A']);

      const res = await call(method, pagesPath(september.id, page.id), 'editor')
        .send({})
        .expect(404);

      expect(res.body.message).toBe('Página no encontrada');
      expect(await stored(august.id)).toEqual([[1, 'A']]);
    },
  );

  it('should answer 400 when an id is not a UUID', async () => {
    await call('post', '/api/admin/issues/no-es-un-uuid/pages', 'editor')
      .send({})
      .expect(400);
  });

  const endpoints: [Method, string][] = [
    ['post', pagesPath(unknownId)],
    ['get', pagesPath(unknownId)],
    ['patch', pagesPath(unknownId, unknownId)],
    ['delete', pagesPath(unknownId, unknownId)],
  ];

  it.each(endpoints)('should forbid %s %s to a plain user', async (method, path) => {
    await call(method, path, 'luis').expect(403);
  });

  it.each(endpoints)('should require a token for %s %s', async (method, path) => {
    await call(method, path).expect(401);
  });
});