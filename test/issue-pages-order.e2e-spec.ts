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
import { UsersService } from '../src/users/users.service';

describe('Issue pages, position and order (e2e)', () => {
  let app: INestApplication;
  let issues: Repository<Issue>;
  let pages: Repository<IssuePage>;
  let editorToken: string;

  // Mensajes de la validación del DTO: "position must be…" / "position must not be…".
  const positionError = expect.arrayContaining([
    expect.stringMatching(/^position must/),
  ]);

  const pagesPath = (issueId: string, pageId?: string) =>
    `/api/admin/issues/${issueId}/pages${pageId ? `/${pageId}` : ''}`;

  const addPage = (issueId: string, body: object) =>
    request(app.getHttpServer())
      .post(pagesPath(issueId))
      .set('Authorization', `Bearer ${editorToken}`)
      .send(body);

  const editPage = (issueId: string, pageId: string, body: object) =>
    request(app.getHttpServer())
      .patch(pagesPath(issueId, pageId))
      .set('Authorization', `Bearer ${editorToken}`)
      .send(body);

  const removePage = (issueId: string, pageId: string) =>
    request(app.getHttpServer())
      .delete(pagesPath(issueId, pageId))
      .set('Authorization', `Bearer ${editorToken}`);

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

  // Lo esperado: los nombres en orden, con la numeración 1, 2, 3… sin huecos.
  const inOrder = (names: string[]) =>
    names.map((name, index) => [index + 1, name]);

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    issues = app.get(getRepositoryToken(Issue));
    pages = app.get(getRepositoryToken(IssuePage));

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'editor@example.com',
        username: 'editor',
        password: 'secret123',
      })
      .expect(201);
    await app.get(UsersService).updateRole(res.body.user.id, Role.EDITOR);
    editorToken = res.body.accessToken;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('adding a page at a position', () => {
    const inserts: [string, number, string[]][] = [
      ['in the middle', 2, ['A', 'N', 'B', 'C']],
      ['at the front', 1, ['N', 'A', 'B', 'C']],
      ['at the end, like appending', 4, ['A', 'B', 'C', 'N']],
    ];

    it.each(inserts)(
      'should add a page %s',
      async (_where, position, expected) => {
        const issue = await seedIssue('octubre-2026');
        await seedPages(issue.id, ['A', 'B', 'C']);

        const res = await addPage(issue.id, {
          position,
          data: { name: 'N' },
        }).expect(201);

        expect(res.body.pageNumber).toBe(position);
        expect(await stored(issue.id)).toEqual(inOrder(expected));
      },
    );

    it('should refuse a position beyond the end', async () => {
      const issue = await seedIssue('octubre-2026');
      await seedPages(issue.id, ['A', 'B', 'C']);

      const res = await addPage(issue.id, {
        position: 5,
        data: { name: 'N' },
      }).expect(400);

      expect(res.body.message).toBe('La posición tiene que estar entre 1 y 4');
      expect(await stored(issue.id)).toEqual(inOrder(['A', 'B', 'C']));
    });

    it.each([0, -1, 1.5, 'dos'])(
      'should refuse the position %j',
      async (position) => {
        const issue = await seedIssue('octubre-2026');
        await seedPages(issue.id, ['A', 'B']);

        const res = await addPage(issue.id, { position }).expect(400);

        expect(res.body.message).toEqual(positionError);
        expect(await stored(issue.id)).toEqual(inOrder(['A', 'B']));
      },
    );
  });

  describe('moving a page', () => {
    const names = ['A', 'B', 'C', 'D'];
    const moves: [string, string, number, string[]][] = [
      ['forward', 'A', 3, ['B', 'C', 'A', 'D']],
      ['backward', 'D', 2, ['A', 'D', 'B', 'C']],
      ['to the front', 'C', 1, ['C', 'A', 'B', 'D']],
      ['to the end', 'A', 4, ['B', 'C', 'D', 'A']],
      ['to where it already is', 'B', 2, ['A', 'B', 'C', 'D']],
    ];

    it.each(moves)(
      'should move a page %s',
      async (_how, name, position, expected) => {
        const issue = await seedIssue('octubre-2026');
        const saved = await seedPages(issue.id, names);
        const page = saved[names.indexOf(name)];

        const res = await editPage(issue.id, page.id, { position }).expect(200);

        expect(res.body).toMatchObject({ id: page.id, pageNumber: position });
        expect(await stored(issue.id)).toEqual(inOrder(expected));
      },
    );

    it('should refuse a position beyond the last page', async () => {
      const issue = await seedIssue('octubre-2026');
      const [first] = await seedPages(issue.id, ['A', 'B', 'C']);

      const res = await editPage(issue.id, first.id, { position: 4 }).expect(
        400,
      );

      expect(res.body.message).toBe('La posición tiene que estar entre 1 y 3');
      expect(await stored(issue.id)).toEqual(inOrder(['A', 'B', 'C']));
    });

    it.each([0, -1, 1.5, 'dos'])(
      'should refuse the position %j',
      async (position) => {
        const issue = await seedIssue('octubre-2026');
        const [first] = await seedPages(issue.id, ['A', 'B']);

        const res = await editPage(issue.id, first.id, { position }).expect(
          400,
        );

        expect(res.body.message).toEqual(positionError);
        expect(await stored(issue.id)).toEqual(inOrder(['A', 'B']));
      },
    );

    it('should change the data and the place at once', async () => {
      const issue = await seedIssue('octubre-2026');
      const [, , third] = await seedPages(issue.id, ['A', 'B', 'C']);

      const res = await editPage(issue.id, third.id, {
        position: 1,
        data: { name: 'C corregida' },
      }).expect(200);

      expect(res.body).toMatchObject({
        pageNumber: 1,
        data: { name: 'C corregida' },
      });
      expect(await stored(issue.id)).toEqual(
        inOrder(['C corregida', 'A', 'B']),
      );
    });

    it('should leave the pages of other issues alone', async () => {
      const august = await seedIssue('agosto-2026');
      const september = await seedIssue('septiembre-2026');
      const [first] = await seedPages(august.id, ['A', 'B', 'C']);
      await seedPages(september.id, ['X', 'Y']);

      await editPage(august.id, first.id, { position: 3 }).expect(200);

      expect(await stored(august.id)).toEqual(inOrder(['B', 'C', 'A']));
      expect(await stored(september.id)).toEqual(inOrder(['X', 'Y']));
    });

    it('should answer 404 for a page of another issue before judging the position', async () => {
      const august = await seedIssue('agosto-2026');
      const september = await seedIssue('septiembre-2026');
      const [page] = await seedPages(august.id, ['A']);

      const res = await editPage(september.id, page.id, {
        position: 99,
      }).expect(404);

      expect(res.body.message).toBe('Página no encontrada');
    });
  });

  it('should show the new order to readers of a published issue', async () => {
    const issue = await seedIssue('octubre-2026', IssueStatus.PUBLISHED);
    const [, , third] = await seedPages(issue.id, ['A', 'B', 'C']);

    await editPage(issue.id, third.id, { position: 1 }).expect(200);
    await addPage(issue.id, { position: 2, data: { name: 'N' } }).expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/issues/octubre-2026')
      .expect(200);

    expect(
      res.body.pages.map(
        (page: { pageNumber: number; data: { name: string } }) => [
          page.pageNumber,
          page.data.name,
        ],
      ),
    ).toEqual(inOrder(['C', 'N', 'A', 'B']));
  });

  it('should keep the numbering gapless through a series of changes', async () => {
    const issue = await seedIssue('octubre-2026');
    const [first, , third] = await seedPages(issue.id, ['A', 'B', 'C']);

    await addPage(issue.id, { position: 1, data: { name: 'D' } }).expect(201); // D A B C
    await editPage(issue.id, third.id, { position: 2 }).expect(200); // D C A B
    await removePage(issue.id, first.id).expect(204); // D C B
    await addPage(issue.id, { position: 3, data: { name: 'E' } }).expect(201); // D C E B

    expect(await stored(issue.id)).toEqual(inOrder(['D', 'C', 'E', 'B']));
  });
});