import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Role } from '../../common/roles.enum';

export class UpdateRoleDto {
  @ApiProperty({ enum: Role, example: Role.EDITOR })
  @IsEnum(Role)
  role!: Role;
}