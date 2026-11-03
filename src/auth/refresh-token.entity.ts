import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  userId!: string;

  // Todos los tokens que salen de un mismo inicio de sesión comparten familia.
  @Index()
  @Column()
  familyId!: string;

  @Index({ unique: true })
  @Column()
  tokenHash!: string;

  @Column()
  expiresAt!: Date;

  @Column({ default: false })
  revoked!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}