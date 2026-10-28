import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from './user.entity';

export interface CreateUserData {
  email: string;
  username: string;
  password: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async create(data: CreateUserData): Promise<User> {
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = this.users.create({
      email: data.email,
      username: data.username,
      passwordHash,
    });
    return this.users.save(user);
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }
}
