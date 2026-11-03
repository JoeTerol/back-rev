import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, Min } from 'class-validator';

export class UpdatePageDto {
  @ApiPropertyOptional({
    description: 'Reemplaza el contenido de la página',
    example: { image: 'tapa.jpg', caption: 'Gallo criollo' },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Mueve la página a este lugar de la edición (1 = primera)',
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  position?: number;
}