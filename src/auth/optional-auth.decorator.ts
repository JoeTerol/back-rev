import { SetMetadata } from '@nestjs/common';

export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';

// La ruta anda con o sin sesión. Sin token se atiende como visitante; con token,
// el token tiene que ser válido, igual que en cualquier ruta protegida.
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);