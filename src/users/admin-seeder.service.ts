import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Role } from '../common/roles.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

export const ADMIN_SEED = Symbol('ADMIN_SEED');

export interface AdminSeedOptions {
  email?: string;
  username?: string;
  password?: string;
}

@Injectable()
export class AdminSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeeder.name);

  constructor(
    private readonly users: UsersService,
    @Inject(ADMIN_SEED) private readonly options: AdminSeedOptions,
  ) {}

  onApplicationBootstrap(): Promise<void> {
    return this.seed();
  }

  async seed(): Promise<void> {
    const { email, password } = this.options;
    if (!email && !password) {
      return;
    }

    // Mismas reglas que un registro común: email válido, clave de 8 a 72, etc.
    const data = plainToInstance(CreateUserDto, {
      email,
      username: this.options.username || 'admin',
      password,
    });
    const errors = await validate(data);
    if (errors.length > 0) {
      const details = errors
        .flatMap((error) => Object.values(error.constraints ?? {}))
        .join('; ');
      throw new Error(`El admin inicial no es válido: ${details}`);
    }

    // Si ya hay una cuenta con ese email NO se toca ni se promueve: sin
    // verificación de emails, alguien podría haberla registrado antes.
    const existing = await this.users.findByEmailWithPassword(data.email);
    if (existing) {
      this.logger.log(
        `Ya hay una cuenta con el email ${existing.email}; no se modifica`,
      );
      return;
    }

    const user = await this.users.create(data);
    await this.users.updateRole(user.id, Role.ADMIN);
    this.logger.log(`Admin inicial creado: ${user.email}`);
  }
}