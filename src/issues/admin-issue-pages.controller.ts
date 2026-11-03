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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { IssuePagesService } from './issue-pages.service';
import { IssuePage } from './issue-page.entity';

@ApiTags('admin / pages')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Solo editores y administradores' })
@Controller('admin/issues/:issueId/pages')
export class AdminIssuePagesController {
  constructor(private readonly pagesService: IssuePagesService) {}

  @Roles(Role.EDITOR, Role.ADMIN)
  @ApiOperation({ summary: 'Agregar una página al final de la edición' })
  @ApiNotFoundResponse({ description: 'Edición no encontrada' })
  @Post()
  async add(
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @Body() dto: CreatePageDto,
  ) {
    return this.toView(await this.pagesService.add(issueId, dto));
  }

  @Roles(Role.EDITOR, Role.ADMIN)
  @ApiOperation({ summary: 'Listar las páginas de la edición, en orden' })
  @ApiNotFoundResponse({ description: 'Edición no encontrada' })
  @Get()
  async list(@Param('issueId', ParseUUIDPipe) issueId: string) {
    const pages = await this.pagesService.list(issueId);
    return pages.map((page) => this.toView(page));
  }

  @Roles(Role.EDITOR, Role.ADMIN)
  @ApiOperation({ summary: 'Cambiar el contenido de una página' })
  @ApiNotFoundResponse({ description: 'Página no encontrada' })
  @Patch(':pageId')
  async update(
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() dto: UpdatePageDto,
  ) {
    return this.toView(await this.pagesService.update(issueId, pageId, dto));
  }

  @Roles(Role.EDITOR, Role.ADMIN)
  @ApiOperation({ summary: 'Borrar una página y correr la numeración' })
  @ApiNotFoundResponse({ description: 'Página no encontrada' })
  @ApiConflictResponse({
    description: 'Es la última página de una edición publicada',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':pageId')
  async remove(
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
  ): Promise<void> {
    await this.pagesService.remove(issueId, pageId);
  }

  private toView(page: IssuePage) {
    return { id: page.id, pageNumber: page.pageNumber, data: page.data };
  }
}