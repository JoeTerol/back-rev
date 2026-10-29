import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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