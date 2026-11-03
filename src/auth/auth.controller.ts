import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { User } from '../users/user.entity';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from './public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @ApiOperation({ summary: 'Registrar una cuenta nueva' })
  @ApiConflictResponse({ description: 'El email o el username ya están en uso' })
  @Post('register')
  register(@Body() dto: CreateUserDto) {
    return this.authService.register(dto);
  }

  @Public()
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiUnauthorizedResponse({ description: 'Credenciales inválidas' })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @ApiOperation({ summary: 'Canjear un refresh token por un par nuevo' })
  @ApiUnauthorizedResponse({ description: 'Sesión inválida o vencida' })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @ApiOperation({ summary: 'Cerrar la sesión de este dispositivo' })
  @ApiNoContentResponse({ description: 'Sesión cerrada' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar todas las sesiones de la cuenta' })
  @ApiNoContentResponse({ description: 'Todas las sesiones cerradas' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout-all')
  async logoutAll(@CurrentUser() user: User): Promise<void> {
    await this.authService.logoutAll(user.id);
  }
}