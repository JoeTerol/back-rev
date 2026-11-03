import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class CreatePageDto {
  @ApiPropertyOptional({
    description: 'Lo que necesite el carrusel: imagen, textos, zonas…',
    example: { image: 'tapa.jpg', caption: 'Gallo criollo' },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}