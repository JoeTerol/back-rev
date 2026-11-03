import { DataSource, Repository } from 'typeorm';
import { IssuePage } from './issue-page.entity';
import { IssueStatus } from './issue-status.enum';
import { Issue } from './issue.entity';

describe('Issue and IssuePage entities', () => {
  let dataSource: DataSource;
  let issues: Repository<Issue>;
  let pages: Repository<IssuePage>;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqljs',
      entities: [Issue, IssuePage],
      synchronize: true,
    });
    await dataSource.initialize();
    issues = dataSource.getRepository(Issue);
    pages = dataSource.getRepository(IssuePage);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  const newIssue = (slug = 'octubre-2026') =>
    issues.save(issues.create({ title: 'Octubre 2026', slug }));

  it('should create an issue as a draft with an empty summary', async () => {
    const saved = await newIssue();

    const issue = await issues.findOneByOrFail({ id: saved.id });

    expect(issue.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(issue.status).toBe(IssueStatus.DRAFT);
    expect(issue.summary).toBe('');
    expect(issue.createdAt).toBeInstanceOf(Date);
  });

  it('should not allow two issues with the same slug', async () => {
    await newIssue('octubre-2026');

    await expect(newIssue('octubre-2026')).rejects.toThrow();
  });

  it('should keep the pages of an issue', async () => {
    const issue = await newIssue();
    await pages.save([
      pages.create({ issueId: issue.id, pageNumber: 1 }),
      pages.create({ issueId: issue.id, pageNumber: 2 }),
    ]);

    const loaded = await issues.findOneOrFail({
      where: { id: issue.id },
      relations: { pages: true },
    });

    expect(loaded.pages.map((page) => page.pageNumber).sort()).toEqual([1, 2]);
  });

  it('should store free-form data on a page', async () => {
    const issue = await newIssue();
    const data = {
      image: 'tapa.jpg',
      hotspots: [{ x: 10, y: 20, label: 'Gallo criollo' }],
      flip: true,
    };
    const saved = await pages.save(
      pages.create({ issueId: issue.id, pageNumber: 1, data }),
    );

    const page = await pages.findOneByOrFail({ id: saved.id });

    expect(page.data).toEqual(data);
  });

  it('should default the page data to an empty object', async () => {
    const issue = await newIssue();
    const saved = await pages.save(
      pages.create({ issueId: issue.id, pageNumber: 1 }),
    );

    const page = await pages.findOneByOrFail({ id: saved.id });

    expect(page.data).toEqual({});
  });

  it('should not save a page without an issue', async () => {
    await expect(
      pages.save(pages.create({ pageNumber: 1 })),
    ).rejects.toThrow();
  });
});