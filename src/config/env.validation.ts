export const DEV_JWT_SECRET = 'dev-only-secret-do-not-use-in-production';
const MIN_SECRET_LENGTH = 32;

export const validateEnv = (
  config: Record<string, unknown>,
): Record<string, unknown> => {
  const nodeEnv = String(config.NODE_ENV ?? 'development');

  const port = String(config.PORT ?? '3000');
  if (!/^\d+$/.test(port)) {
    throw new Error('PORT debe ser un número');
  }

  const secret = config.JWT_ACCESS_SECRET;
  if (nodeEnv === 'production') {
    const valid =
      typeof secret === 'string' &&
      secret.length >= MIN_SECRET_LENGTH &&
      secret !== DEV_JWT_SECRET;
    if (!valid) {
      throw new Error(
        `JWT_ACCESS_SECRET es obligatorio en producción, de al menos ${MIN_SECRET_LENGTH} caracteres y distinto del de desarrollo`,
      );
    }
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    PORT: port,
    JWT_ACCESS_SECRET:
      typeof secret === 'string' && secret.length > 0 ? secret : DEV_JWT_SECRET,
  };
};