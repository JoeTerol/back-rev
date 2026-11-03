import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminIssuesController } from './admin-issues.controller';
import { IssuePage } from './issue-page.entity';
import { Issue } from './issue.entity';
import { IssuesController } from './issues.controller';
import { IssuesService } from './issues.service';

@Module({
  imports: [TypeOrmModule.forFeature([Issue, IssuePage])],
  controllers: [IssuesController, AdminIssuesController],
  providers: [IssuesService],
  exports: [IssuesService],
})
export class IssuesModule {}