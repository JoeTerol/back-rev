import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SetPremiumDto {
  @ApiProperty({
    description:
      'Último día de premium, con formato AAAA-MM-DD. Vence al terminar ese día, hora de Argentina',
    example: '2027-12-31',
  })
  @IsString()
  until!: string;
}