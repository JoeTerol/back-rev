import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IssuePage } from './issue-page.entity';
import { IssueStatus } from './issue-status.enum';

@Entity('issues')
export class Issue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  // Va en la URL de la edición: /issues/octubre-2026
  @Column({ unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  summary: string;

  @Column({ type: 'varchar', length: 20, default: IssueStatus.DRAFT })
  status: IssueStatus;

  @OneToMany(() => IssuePage, (page) => page.issue)
  pages: IssuePage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}