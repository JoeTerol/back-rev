import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// Saca los espacios de los costados antes de validar.
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateIssueDto {
  @ApiProperty({ example: 'Edición de octubre 2026' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ example: 'Gallos criollos y tradiciones de campo' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @ApiPropertyOptional({
    description:
      'Si es premium, quien no tiene suscripción solo ve las primeras páginas. Por defecto es gratis',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;
}