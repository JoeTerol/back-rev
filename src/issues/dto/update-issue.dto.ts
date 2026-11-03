import { PartialType } from '@nestjs/swagger';
import { CreateIssueDto } from './create-issue.dto';

// Mismos campos y reglas que al crear, pero todos opcionales.
export class UpdateIssueDto extends PartialType(CreateIssueDto) {}