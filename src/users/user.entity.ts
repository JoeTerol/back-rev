import {
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

  @Column({ unique: true })
  username: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 20, default: Role.USER })
  role: Role;

  @CreateDateColumn()
  createdAt: Date;
}
