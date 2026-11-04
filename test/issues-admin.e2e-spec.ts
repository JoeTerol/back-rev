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

describe('Issues, editorial management (e2e)', () => {
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

  const createIssue = (who: Who, body: object) =>
    call('post', '/api/admin/issues', who).send(body);

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

  const seedIssue = (slug: string, status: IssueStatus, createdAt: Date) =>
    issues.save(
      issues.create({ title: `Edición ${slug}`, slug, status, createdAt }),
    );

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
    'should let the %s create an issue as a draft',
    async (who) => {
      const res = await createIssue(who, { title: 'Octubre 2026' }).expect(201);

      expect(res.body).toMatchObject({
        title: 'Octubre 2026',
        slug: 'octubre-2026',
        summary: '',
        status: IssueStatus.DRAFT,
      });
      expect(res.body.id).toEqual(expect.any(String));
    },
  );

  it('should build the slug from the title without accents', async () => {
    const res = await createIssue('editor', {
      title: 'Edición de Otoño',
    }).expect(201);

    expect(res.body.slug).toBe('edicion-de-otono');
  });

  it('should add a number to a repeated slug', async () => {
    await createIssue('editor', { title: 'Octubre 2026' }).expect(201);

    const res = await createIssue('editor', {
      title: 'Octubre 2026',
    }).expect(201);

    expect(res.body.slug).toBe('octubre-2026-2');
  });

  it('should refuse a title with no letters or numbers', async () => {
    const res = await createIssue('editor', { title: '!!!' }).expect(400);

    expect(res.body.message).toBe(
      'El título necesita al menos una letra o un número para armar la dirección',
    );
  });

  it('should refuse an issue without a title', async () => {
    await createIssue('editor', { summary: 'Sin título' }).expect(400);
  });

  const endpoints: [Method, string][] = [
    ['post', '/api/admin/issues'],
    ['get', '/api/admin/issues'],
    ['patch', `/api/admin/issues/${unknownId}`],
    ['delete', `/api/admin/issues/${unknownId}`],
  ];

  it.each(endpoints)('should forbid %s %s to a plain user', async (method, path) => {
    await call(method, path, 'luis').expect(403);
  });

  it.each(endpoints)('should require a token for %s %s', async (method, path) => {
    await call(method, path).expect(401);
  });

  it('should list every issue, drafts included, with its status', async () => {
    await seedIssue('agosto-2026', IssueStatus.PUBLISHED, new Date('2026-08-01T12:00:00Z'));
    await seedIssue('septiembre-2026', IssueStatus.DRAFT, new Date('2026-09-01T12:00:00Z'));

    const res = await call('get', '/api/admin/issues', 'editor').expect(200);

    expect(
      res.body.map((issue: { slug: string; status: string }) => [
        issue.slug,
        issue.status,
      ]),
    ).toEqual([
      ['septiembre-2026', 'draft'],
      ['agosto-2026', 'published'],
    ]);
    expect(Object.keys(res.body[0]).sort()).toEqual([
      'createdAt',
      'id',
      'isPremium',
      'slug',
      'status',
      'summary',
      'title',
      'updatedAt',
    ]);
  });

  it('should update title and summary and keep the slug', async () => {
    const created = (
      await createIssue('editor', { title: 'Octubre 2026' }).expect(201)
    ).body;

    const res = await call('patch', `/api/admin/issues/${created.id}`, 'editor')
      .send({ title: 'Octubre de 2026', summary: 'Gallos y tradiciones' })
      .expect(200);

    expect(res.body).toMatchObject({
      title: 'Octubre de 2026',
      summary: 'Gallos y tradiciones',
      slug: 'octubre-2026',
    });
  });

  it('should not let an editor change the status through PATCH', async () => {
    const created = (
      await createIssue('editor', { title: 'Octubre 2026' }).expect(201)
    ).body;

    await call('patch', `/api/admin/issues/${created.id}`, 'editor')
      .send({ status: IssueStatus.PUBLISHED })
      .expect(400);

    const stored = await issues.findOneByOrFail({ id: created.id });
    expect(stored.status).toBe(IssueStatus.DRAFT);
  });

  it('should answer 404 when editing an unknown issue', async () => {
    const res = await call('patch', `/api/admin/issues/${unknownId}`, 'editor')
      .send({ title: 'Nuevo título' })
      .expect(404);

    expect(res.body.message).toBe('Edición no encontrada');
  });

  it('should answer 400 when the id is not a UUID', async () => {
    await call('patch', '/api/admin/issues/no-es-un-uuid', 'editor')
      .send({ title: 'Nuevo título' })
      .expect(400);
  });

  it('should delete an issue together with its pages', async () => {
    const created = (
      await createIssue('editor', { title: 'Octubre 2026' }).expect(201)
    ).body;
    await pages.save([
      pages.create({ issueId: created.id, pageNumber: 1 }),
      pages.create({ issueId: created.id, pageNumber: 2 }),
    ]);

    await call('delete', `/api/admin/issues/${created.id}`, 'editor').expect(204);

    expect(await issues.countBy({ id: created.id })).toBe(0);
    expect(await pages.countBy({ issueId: created.id })).toBe(0);
  });

  it('should answer 404 when deleting an unknown issue', async () => {
    const res = await call('delete', `/api/admin/issues/${unknownId}`, 'editor').expect(404);

    expect(res.body.message).toBe('Edición no encontrada');
  });
});