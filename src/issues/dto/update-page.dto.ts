import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class UpdatePageDto {
  @ApiPropertyOptional({
    description: 'Reemplaza el contenido de la página',
    example: { image: 'tapa.jpg', caption: 'Gallo criollo' },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}