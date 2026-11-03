import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
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

  @Public()
  @ApiOperation({ summary: 'Ver una edición publicada con sus páginas' })
  @ApiNotFoundResponse({ description: 'Edición no encontrada' })
  @Get(':slug')
  async show(@Param('slug') slug: string) {
    const issue = await this.issuesService.getPublishedBySlug(slug);

    return {
      ...this.toSummary(issue),
      pages: issue.pages.map((page) => ({
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
      createdAt: issue.createdAt,
    };
  }
}