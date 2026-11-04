import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { slugify } from '../common/slug';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { IssuePage } from './issue-page.entity';
import { IssueStatus } from './issue-status.enum';
import { Issue } from './issue.entity';

@Injectable()
export class IssuesService {
  constructor(
    @InjectRepository(Issue) private readonly issues: Repository<Issue>,
  ) {}

  findPublished(): Promise<Issue[]> {
    return this.issues.find({
      where: { status: IssueStatus.PUBLISHED },
      order: { createdAt: 'DESC' },
    });
  }

  async getPublishedBySlug(slug: string): Promise<Issue> {
    const issue = await this.issues.findOne({
      where: { slug, status: IssueStatus.PUBLISHED },
      relations: { pages: true },
    });
    if (!issue) {
      throw new NotFoundException('Edición no encontrada');
    }

    // Se ordena acá y no en la consulta: ordenar por una relación junto con
    // findOne da errores en algunas versiones de TypeORM.
    issue.pages.sort((a, b) => a.pageNumber - b.pageNumber);
    return issue;
  }

  findAll(): Promise<Issue[]> {
    return this.issues.find({ order: { createdAt: 'DESC' } });
  }

  async create(dto: CreateIssueDto): Promise<Issue> {
    const slug = await this.uniqueSlug(dto.title);
    const issue = this.issues.create({
      title: dto.title,
      slug,
      summary: dto.summary ?? '',
      isPremium: dto.isPremium ?? false,
      status: IssueStatus.DRAFT,
    });
    return this.issues.save(issue);
  }

  async update(id: string, dto: UpdateIssueDto): Promise<Issue> {
    const issue = await this.getById(id);

    // El slug no se toca: los links ya compartidos tienen que seguir andando.
    if (dto.title !== undefined) {
      issue.title = dto.title;
    }
    if (dto.summary !== undefined) {
      issue.summary = dto.summary;
    }
        if (dto.isPremium !== undefined) {
      issue.isPremium = dto.isPremium;
    } 
    return this.issues.save(issue);
  }

  async publish(id: string): Promise<Issue> {
    const issue = await this.getById(id);
    if (issue.status === IssueStatus.PUBLISHED) {
      return issue;
    }

    const pageCount = await this.issues.manager.countBy(IssuePage, {
      issueId: issue.id,
    });
    if (pageCount === 0) {
      throw new ConflictException(
        'No se puede publicar una edición sin páginas',
      );
    }

    issue.status = IssueStatus.PUBLISHED;
    return this.issues.save(issue);
  }

  async unpublish(id: string): Promise<Issue> {
    const issue = await this.getById(id);
    if (issue.status === IssueStatus.DRAFT) {
      return issue;
    }

    issue.status = IssueStatus.DRAFT;
    return this.issues.save(issue);
  }

  async remove(id: string): Promise<void> {
    const issue = await this.getById(id);
    if (issue.status === IssueStatus.PUBLISHED) {
      throw new ConflictException('Despublicá la edición antes de borrarla');
    }

    // Todo o nada: las páginas y la edición se borran en una transacción.
    await this.issues.manager.transaction(async (manager) => {
      await manager.delete(IssuePage, { issueId: issue.id });
      await manager.delete(Issue, { id: issue.id });
    });
  }

  private async getById(id: string): Promise<Issue> {
    const issue = await this.issues.findOneBy({ id });
    if (!issue) {
      throw new NotFoundException('Edición no encontrada');
    }
    return issue;
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    if (!base) {
      throw new BadRequestException(
        'El título necesita al menos una letra o un número para armar la dirección',
      );
    }

    let slug = base;
    let suffix = 2;
    while (await this.issues.exists({ where: { slug } })) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    return slug;
  }
}