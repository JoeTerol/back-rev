import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'El refresh token que devolvió el login' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  refreshToken!: string;
}