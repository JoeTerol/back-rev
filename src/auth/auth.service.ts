import { Injectable } from '@nestjs/common';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async register(dto: CreateUserDto) {
    const user = await this.usersService.create(dto);

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };
  }
}