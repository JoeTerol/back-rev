export const validateEnv = (
  config: Record<string, unknown>,
): Record<string, unknown> => {
  const port = String(config.PORT ?? '3000');

  if (!/^\d+$/.test(port)) {
    throw new Error('PORT debe ser un número');
  }

  return {
    ...config,
    NODE_ENV: String(config.NODE_ENV ?? 'development'),
    PORT: port,
  };
};