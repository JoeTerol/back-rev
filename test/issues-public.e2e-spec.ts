import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { IssuePage } from '../src/issues/issue-page.entity';
import { IssueStatus } from '../src/issues/issue-status.enum';
import { Issue } from '../src/issues/issue.entity';

describe('Issues, public reading (e2e)', () => {
  let app: INestApplication;
  let issues: Repository<Issue>;
  let pages: Repository<IssuePage>;

  const get = (url: string) => request(app.getHttpServer()).get(url);

  const seedIssue = (slug: string, status: IssueStatus, createdAt: Date) =>
    issues.save(
      issues.create({ title: `Edición ${slug}`, slug, status, createdAt }),
    );

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    issues = app.get(getRepositoryToken(Issue));
    pages = app.get(getRepositoryToken(IssuePage));
  });

  afterEach(async () => {
    await app.close();
  });

  it('should list only the published issues, newest first', async () => {
    await seedIssue(
      'agosto-2026',
      IssueStatus.PUBLISHED,
      new Date('2026-08-01T12:00:00Z'),
    );
    await seedIssue(
      'septiembre-2026',
      IssueStatus.DRAFT,
      new Date('2026-09-01T12:00:00Z'),
    );
    await seedIssue(
      'octubre-2026',
      IssueStatus.PUBLISHED,
      new Date('2026-10-01T12:00:00Z'),
    );

    const res = await get('/api/issues').expect(200);

    expect(res.body.map((issue: { slug: string }) => issue.slug)).toEqual([
      'octubre-2026',
      'agosto-2026',
    ]);
  });

  it('should show only the public fields of each issue in the list', async () => {
    await seedIssue(
      'octubre-2026',
      IssueStatus.PUBLISHED,
      new Date('2026-10-01T12:00:00Z'),
    );

    const res = await get('/api/issues').expect(200);

    expect(Object.keys(res.body[0]).sort()).toEqual([
      'createdAt',
      'id',
      'isPremium',
      'slug',
      'summary',
      'title',
    ]);
  });

  it('should answer an empty list when nothing is published', async () => {
    await seedIssue(
      'septiembre-2026',
      IssueStatus.DRAFT,
      new Date('2026-09-01T12:00:00Z'),
    );

    const res = await get('/api/issues').expect(200);

    expect(res.body).toEqual([]);
  });

  it('should show a published issue with its pages in order', async () => {
    const issue = await seedIssue(
      'octubre-2026',
      IssueStatus.PUBLISHED,
      new Date('2026-10-01T12:00:00Z'),
    );
    await pages.save([
      pages.create({
        issueId: issue.id,
        pageNumber: 3,
        data: { image: 'c.jpg' },
      }),
      pages.create({
        issueId: issue.id,
        pageNumber: 1,
        data: { image: 'a.jpg' },
      }),
      pages.create({
        issueId: issue.id,
        pageNumber: 2,
        data: { image: 'b.jpg' },
      }),
    ]);

    const res = await get('/api/issues/octubre-2026').expect(200);

    expect(res.body.title).toBe('Edición octubre-2026');
    expect(
      res.body.pages.map((page: { pageNumber: number }) => page.pageNumber),
    ).toEqual([1, 2, 3]);
    expect(res.body.pages[0].data).toEqual({ image: 'a.jpg' });
  });

  it('should show only the public fields of an issue and its pages', async () => {
    const issue = await seedIssue(
      'octubre-2026',
      IssueStatus.PUBLISHED,
      new Date('2026-10-01T12:00:00Z'),
    );
    await pages.save(pages.create({ issueId: issue.id, pageNumber: 1 }));

    const res = await get('/api/issues/octubre-2026').expect(200);

    expect(Object.keys(res.body).sort()).toEqual([
      'createdAt',
      'id',
      'isPremium',
      'locked',
      'pages',
      'slug',
      'summary',
      'title',
      'totalPages',
    ]);
    expect(Object.keys(res.body.pages[0]).sort()).toEqual([
      'data',
      'id',
      'pageNumber',
    ]);
  });

  it('should answer 404 for a draft', async () => {
    await seedIssue(
      'septiembre-2026',
      IssueStatus.DRAFT,
      new Date('2026-09-01T12:00:00Z'),
    );

    const res = await get('/api/issues/septiembre-2026').expect(404);

    expect(res.body.message).toBe('Edición no encontrada');
  });

  it('should answer 404 for an unknown slug', async () => {
    const res = await get('/api/issues/no-existe').expect(404);

    expect(res.body.message).toBe('Edición no encontrada');
  });
});