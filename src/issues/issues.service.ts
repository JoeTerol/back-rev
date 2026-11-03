import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
}