import { ConflictException, Injectable } from '@nestjs/common';
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
    const email = this.normalizeEmail(data.email);

    const emailTaken = await this.users.exists({ where: { email } });
    if (emailTaken) {
      throw new ConflictException('Ya existe una cuenta con ese email');
    }

    const usernameTaken = await this.users.exists({
      where: { username: data.username },
    });
    if (usernameTaken) {
      throw new ConflictException('Ese nombre de usuario ya está en uso');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = this.users.create({
      email,
      username: data.username,
      passwordHash,
    });
    return this.users.save(user);
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.users.findOneBy({ username });
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: this.normalizeEmail(email) })
      .getOne();
  }

  private normalizeEmail(email: string): string {
    return email.toLowerCase();
  }
}
