import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { Issue } from './issue.entity';
import { IssuesService } from './issues.service';

@ApiTags('admin-issues')
@ApiBearerAuth()
@Controller('admin/issues')
export class AdminIssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Roles(Role.EDITOR, Role.ADMIN)
  @ApiOperation({ summary: 'Crear una edición (queda como borrador)' })
  @Post()
  async create(@Body() dto: CreateIssueDto) {
    return this.toView(await this.issuesService.create(dto));
  }

  @Roles(Role.EDITOR, Role.ADMIN)
  @ApiOperation({ summary: 'Listar todas las ediciones, borradores incluidos' })
  @Get()
  async list() {
    const issues = await this.issuesService.findAll();
    return issues.map((issue) => this.toView(issue));
  }

  @Roles(Role.EDITOR, Role.ADMIN)
  @ApiOperation({ summary: 'Editar el título, el resumen o si es premium' })
  @ApiNotFoundResponse({ description: 'Edición no encontrada' })
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIssueDto,
  ) {
    return this.toView(await this.issuesService.update(id, dto));
  }

  @Roles(Role.EDITOR, Role.ADMIN)
  @ApiOperation({ summary: 'Publicar una edición' })
  @ApiNotFoundResponse({ description: 'Edición no encontrada' })
  @ApiConflictResponse({
    description: 'No se puede publicar una edición sin páginas',
  })
  @HttpCode(HttpStatus.OK)
  @Post(':id/publish')
  async publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.toView(await this.issuesService.publish(id));
  }

  @Roles(Role.EDITOR, Role.ADMIN)
  @ApiOperation({ summary: 'Volver una edición a borrador' })
  @ApiNotFoundResponse({ description: 'Edición no encontrada' })
  @HttpCode(HttpStatus.OK)
  @Post(':id/unpublish')
  async unpublish(@Param('id', ParseUUIDPipe) id: string) {
    return this.toView(await this.issuesService.unpublish(id));
  }

  @Roles(Role.EDITOR, Role.ADMIN)
  @ApiOperation({ summary: 'Borrar una edición con todas sus páginas' })
  @ApiNotFoundResponse({ description: 'Edición no encontrada' })
  @ApiConflictResponse({
    description: 'Hay que despublicar la edición antes de borrarla',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.issuesService.remove(id);
  }

  private toView(issue: Issue) {
    return {
      id: issue.id,
      title: issue.title,
      slug: issue.slug,
      summary: issue.summary,
      status: issue.status,
      isPremium: issue.isPremium,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    };
  }
}