import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, Min } from 'class-validator';

export class CreatePageDto {
  @ApiPropertyOptional({
    description: 'Lo que necesite el carrusel: imagen, textos, zonas…',
    example: { image: 'tapa.jpg', caption: 'Gallo criollo' },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Lugar de la página en la edición (1 = primera). Si falta, va al final',
    minimum: 1,
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  position?: number;
}