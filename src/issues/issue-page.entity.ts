import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Issue } from './issue.entity';

@Entity('issue_pages')
export class IssuePage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  issueId: string;

  @ManyToOne(() => Issue, (issue) => issue.pages, { nullable: false })
  @JoinColumn({ name: 'issueId' })
  issue: Relation<Issue>;

  // Posición de la página dentro de la edición (1, 2, 3…).
  @Column()
  pageNumber: number;

  // Campo libre para lo que necesite el carrusel (imagen, textos, zonas…).
  @Column({ type: 'simple-json' })
  data: Record<string, unknown> = {};

  @CreateDateColumn()
  createdAt: Date;
}