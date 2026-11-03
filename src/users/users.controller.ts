import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
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
}