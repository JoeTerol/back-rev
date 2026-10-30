import { DEV_JWT_SECRET, validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('should default NODE_ENV to development', () => {
    expect(validateEnv({}).NODE_ENV).toBe('development');
  });

  it('should default PORT to 3000', () => {
    expect(validateEnv({}).PORT).toBe('3000');
  });

  it('should keep the values that were provided', () => {
    const result = validateEnv({ NODE_ENV: 'test', PORT: '4000' });

    expect(result.NODE_ENV).toBe('test');
    expect(result.PORT).toBe('4000');
  });

  it('should reject a PORT that is not a number', () => {
    expect(() => validateEnv({ PORT: 'abc' })).toThrow(
      'PORT debe ser un número',
    );
  });

  it('should provide a development secret outside production', () => {
    const secret = validateEnv({}).JWT_ACCESS_SECRET;

    expect(typeof secret).toBe('string');
    expect(secret).toBe(DEV_JWT_SECRET);
  });

  it('should keep a JWT_ACCESS_SECRET that was provided', () => {
    const provided = 'x'.repeat(40);

    expect(validateEnv({ JWT_ACCESS_SECRET: provided }).JWT_ACCESS_SECRET).toBe(
      provided,
    );
  });

  it('should require JWT_ACCESS_SECRET in production', () => {
    expect(() => validateEnv({ NODE_ENV: 'production' })).toThrow(
      'JWT_ACCESS_SECRET',
    );
  });

  it('should reject a short JWT_ACCESS_SECRET in production', () => {
    expect(() =>
      validateEnv({ NODE_ENV: 'production', JWT_ACCESS_SECRET: 'corto' }),
    ).toThrow('JWT_ACCESS_SECRET');
  });

  it('should reject the development secret in production', () => {
    expect(() =>
      validateEnv({ NODE_ENV: 'production', JWT_ACCESS_SECRET: DEV_JWT_SECRET }),
    ).toThrow('JWT_ACCESS_SECRET');
  });
});