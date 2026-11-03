import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminIssuePagesController } from './admin-issue-pages.controller';
import { AdminIssuesController } from './admin-issues.controller';
import { IssuePage } from './issue-page.entity';
import { IssuePagesService } from './issue-pages.service';
import { Issue } from './issue.entity';
import { IssuesController } from './issues.controller';
import { IssuesService } from './issues.service';

@Module({
  imports: [TypeOrmModule.forFeature([Issue, IssuePage])],
  controllers: [
    IssuesController,
    AdminIssuesController,
    AdminIssuePagesController,
  ],
  providers: [IssuesService, IssuePagesService],
  exports: [IssuesService],
})
export class IssuesModule {}