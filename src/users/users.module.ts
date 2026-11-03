import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ADMIN_SEED,
  AdminSeedOptions,
  AdminSeeder,
} from './admin-seeder.service';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [
    UsersService,
    AdminSeeder,
    {
      provide: ADMIN_SEED,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AdminSeedOptions => ({
        email: config.get<string>('SEED_ADMIN_EMAIL'),
        username: config.get<string>('SEED_ADMIN_USERNAME'),
        password: config.get<string>('SEED_ADMIN_PASSWORD'),
      }),
    },
  ],
  exports: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}