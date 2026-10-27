import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('should apply defaults when variables are missing', () => {
    expect(validateEnv({})).toMatchObject({
      NODE_ENV: 'development',
      PORT: '3000',
    });
  });

  it('should keep the values it receives', () => {
    expect(validateEnv({ PORT: '4000' })).toMatchObject({ PORT: '4000' });
  });

  it('should keep the NODE_ENV it receives', () => {
    expect(validateEnv({ NODE_ENV: 'production' })).toMatchObject({
      NODE_ENV: 'production',
    });
  });

  it('should reject a PORT that is not a number', () => {
    expect(() => validateEnv({ PORT: 'abc' })).toThrow('PORT');
  });
});