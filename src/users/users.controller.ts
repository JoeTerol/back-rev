import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import { UpdateRoleDto } from './dto/update-role.dto';
import { User } from './user.entity';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Datos de la cuenta que inició sesión' })
  @ApiUnauthorizedResponse({ description: 'Falta el token o no es válido' })
  @Get('me')
  getMe(@CurrentUser() user: User) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  @Public()
  @ApiOperation({ summary: 'Perfil público de un usuario' })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado' })
  @Get('public/:username')
  async getPublicProfile(@Param('username') username: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar el rol de un usuario (solo admin)' })
  @ApiForbiddenResponse({ description: 'No tenés permiso para hacer esto' })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado' })
  @Patch(':id/role')
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() currentUser: User,
  ) {
    if (id === currentUser.id) {
      throw new BadRequestException('No podés cambiar tu propio rol');
    }

    const user = await this.usersService.updateRole(id, dto.role);
    return { id: user.id, username: user.username, role: user.role };
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Suspender una cuenta (solo admin)' })
  @ApiForbiddenResponse({
    description: 'No sos admin, o la cuenta a suspender es de un admin',
  })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado' })
  @HttpCode(HttpStatus.OK)
  @Post(':id/ban')
  async ban(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ) {
    if (id === currentUser.id) {
      throw new BadRequestException('No podés suspender tu propia cuenta');
    }

    const user = await this.usersService.setBanned(id, true);
    return this.toBanView(user);
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reactivar una cuenta suspendida (solo admin)' })
  @ApiForbiddenResponse({ description: 'No tenés permiso para hacer esto' })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado' })
  @HttpCode(HttpStatus.OK)
  @Post(':id/unban')
  async unban(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersService.setBanned(id, false);
    return this.toBanView(user);
  }

  private toBanView(user: User) {
    return { id: user.id, username: user.username, banned: user.banned };
  }
}