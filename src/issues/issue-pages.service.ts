import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { IssuePage } from './issue-page.entity';
import { IssueStatus } from './issue-status.enum';
import { Issue } from './issue.entity';

@Injectable()
export class IssuePagesService {
  constructor(
    @InjectRepository(IssuePage) private readonly pages: Repository<IssuePage>,
  ) {}

  async list(issueId: string): Promise<IssuePage[]> {
    await this.assertIssueExists(this.pages.manager, issueId);
    return this.pages.find({
      where: { issueId },
      order: { pageNumber: 'ASC' },
    });
  }

  add(issueId: string, dto: CreatePageDto): Promise<IssuePage> {
    return this.pages.manager.transaction(async (manager) => {
      await this.assertIssueExists(manager, issueId);

      const count = await manager.countBy(IssuePage, { issueId });
      const page = manager.create(IssuePage, {
        issueId,
        pageNumber: count + 1,
        data: dto.data ?? {},
      });
      return manager.save(page);
    });
  }

  async update(
    issueId: string,
    pageId: string,
    dto: UpdatePageDto,
  ): Promise<IssuePage> {
    const page = await this.pages.findOneBy({ id: pageId, issueId });
    if (!page) {
      throw new NotFoundException('Página no encontrada');
    }

    if (dto.data !== undefined) {
      page.data = dto.data;
    }
    return this.pages.save(page);
  }

  async remove(issueId: string, pageId: string): Promise<void> {
    // Todo o nada: se borra la página y se corre la numeración, o no se hace nada.
    await this.pages.manager.transaction(async (manager) => {
      const page = await manager.findOneBy(IssuePage, { id: pageId, issueId });
      if (!page) {
        throw new NotFoundException('Página no encontrada');
      }

      const all = await manager.find(IssuePage, {
        where: { issueId },
        order: { pageNumber: 'ASC' },
      });
      const issue = await manager.findOneByOrFail(Issue, { id: issueId });
      if (issue.status === IssueStatus.PUBLISHED && all.length === 1) {
        throw new ConflictException(
          'No se puede borrar la última página de una edición publicada. Despublicala primero',
        );
      }

      await manager.delete(IssuePage, { id: pageId });
      await this.renumber(
        manager,
        all.filter((other) => other.id !== pageId),
      );
    });
  }

  // Deja las páginas numeradas 1, 2, 3… en el orden en que vienen.
  private async renumber(manager: EntityManager, ordered: IssuePage[]) {
    const changed: IssuePage[] = [];
    ordered.forEach((page, index) => {
      if (page.pageNumber !== index + 1) {
        page.pageNumber = index + 1;
        changed.push(page);
      }
    });

    if (changed.length > 0) {
      await manager.save(changed);
    }
  }

  private async assertIssueExists(manager: EntityManager, issueId: string) {
    const exists = await manager.existsBy(Issue, { id: issueId });
    if (!exists) {
      throw new NotFoundException('Edición no encontrada');
    }
  }
}