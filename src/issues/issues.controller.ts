import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalAuth } from '../auth/optional-auth.decorator';
import { Public } from '../auth/public.decorator';
import { isPremium, pagesVisibleTo } from '../premium/premium-rules';
import { User } from '../users/user.entity';
import { Issue } from './issue.entity';
import { IssuesService } from './issues.service';

@ApiTags('issues')
@Controller('issues')
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Public()
  @ApiOperation({ summary: 'Listar las ediciones publicadas' })
  @Get()
  async list() {
    const issues = await this.issuesService.findPublished();
    return issues.map((issue) => this.toSummary(issue));
  }

  @OptionalAuth()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Ver una edición publicada con sus páginas',
    description:
      'Si la edición es premium y quien la pide no tiene premium (o no inició sesión), trae solo las primeras páginas y locked: true.',
  })
  @ApiNotFoundResponse({ description: 'Edición no encontrada' })
  @ApiUnauthorizedResponse({
    description: 'Mandaste un token que no es válido o venció',
  })
  @Get(':slug')
  async show(
    @Param('slug') slug: string,
    @CurrentUser() reader: User | undefined,
  ) {
    const issue = await this.issuesService.getPublishedBySlug(slug);
    const access = pagesVisibleTo(issue.pages, {
      editionIsPremium: issue.isPremium,
      readerIsPremium: isPremium(reader?.premiumUntil, new Date()),
    });

    return {
      ...this.toSummary(issue),
      locked: access.locked,
      totalPages: access.totalPages,
      pages: access.pages.map((page) => ({
        id: page.id,
        pageNumber: page.pageNumber,
        data: page.data,
      })),
    };
  }

  private toSummary(issue: Issue) {
    return {
      id: issue.id,
      title: issue.title,
      slug: issue.slug,
      summary: issue.summary,
      isPremium: issue.isPremium,
      createdAt: issue.createdAt,
    };
  }
}