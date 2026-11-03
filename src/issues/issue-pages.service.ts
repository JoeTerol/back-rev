import {
  BadRequestException,
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
    return this.loadOrdered(this.pages.manager, issueId);
  }

  add(issueId: string, dto: CreatePageDto): Promise<IssuePage> {
    return this.pages.manager.transaction(async (manager) => {
      await this.assertIssueExists(manager, issueId);

      const all = await this.loadOrdered(manager, issueId);
      const position = dto.position ?? all.length + 1;
      this.assertPosition(position, all.length + 1);

      const page = await manager.save(
        manager.create(IssuePage, {
          issueId,
          pageNumber: position,
          data: dto.data ?? {},
        }),
      );

      // Las páginas que estaban desde ese lugar en adelante se corren una.
      all.splice(position - 1, 0, page);
      await this.renumber(manager, all);
      return page;
    });
  }

  update(
    issueId: string,
    pageId: string,
    dto: UpdatePageDto,
  ): Promise<IssuePage> {
    return this.pages.manager.transaction(async (manager) => {
      const all = await this.loadOrdered(manager, issueId);
      const page = all.find((other) => other.id === pageId);
      if (!page) {
        throw new NotFoundException('Página no encontrada');
      }

      if (dto.data !== undefined) {
        page.data = dto.data;
      }

      if (dto.position !== undefined) {
        this.assertPosition(dto.position, all.length);
        // Se la saca de su lugar y se la pone en el nuevo; el resto se acomoda.
        const reordered = all.filter((other) => other.id !== pageId);
        reordered.splice(dto.position - 1, 0, page);
        await this.renumber(manager, reordered);
      }

      return manager.save(page);
    });
  }

  async remove(issueId: string, pageId: string): Promise<void> {
    // Todo o nada: se borra la página y se corre la numeración, o no se hace nada.
    await this.pages.manager.transaction(async (manager) => {
      const all = await this.loadOrdered(manager, issueId);
      if (!all.some((page) => page.id === pageId)) {
        throw new NotFoundException('Página no encontrada');
      }

      const issue = await manager.findOneByOrFail(Issue, { id: issueId });
      if (issue.status === IssueStatus.PUBLISHED && all.length === 1) {
        throw new ConflictException(
          'No se puede borrar la última página de una edición publicada. Despublicala primero',
        );
      }

      await manager.delete(IssuePage, { id: pageId });
      await this.renumber(
        manager,
        all.filter((page) => page.id !== pageId),
      );
    });
  }

  private loadOrdered(manager: EntityManager, issueId: string) {
    return manager.find(IssuePage, {
      where: { issueId },
      order: { pageNumber: 'ASC' },
    });
  }

  private assertPosition(position: number, max: number) {
    if (position < 1 || position > max) {
      throw new BadRequestException(
        `La posición tiene que estar entre 1 y ${max}`,
      );
    }
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