import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Role } from '../common/roles.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  // Tal cual lo escribió la persona: así se muestra.
  @Column({ unique: true })
  username: string;

  // Copia en minúsculas, solo para comparar sin distinguir mayúsculas.
  @Column({ unique: true })
  usernameLower: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 20, default: Role.USER })
  role: Role;

  @Column({ default: false })
  banned: boolean;
    // Hasta cuándo tiene premium. null = no tiene. Se calcula al leer, sin tareas programadas.
  @Column({ type: Date, nullable: true })
  premiumUntil: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  syncUsernameLower() {
    if (this.username) {
      this.usernameLower = this.username.toLowerCase();
    }
  }
}