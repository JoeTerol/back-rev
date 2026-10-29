import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

const invalidFields = async (data: Record<string, unknown>): Promise<string[]> => {
  const errors = await validate(plainToInstance(CreateUserDto, data));
  return errors.map((e) => e.property).sort();
};

describe('CreateUserDto', () => {
  const valid = {
    email: 'ana@example.com',
    username: 'ana_2',
    password: 'secret123',
  };

  it('should accept valid data', async () => {
    expect(await invalidFields(valid)).toEqual([]);
  });

  it('should reject an invalid email', async () => {
    expect(await invalidFields({ ...valid, email: 'no-es-un-email' })).toEqual(['email']);
  });

  it('should reject a password shorter than 8 characters', async () => {
    expect(await invalidFields({ ...valid, password: '1234567' })).toEqual(['password']);
  });

  it('should reject a password longer than 72 characters', async () => {
    expect(await invalidFields({ ...valid, password: 'a'.repeat(73) })).toEqual(['password']);
  });

  it('should reject a username with spaces or symbols', async () => {
    expect(await invalidFields({ ...valid, username: 'ana pérez!' })).toEqual(['username']);
  });

  it('should reject a username shorter than 3 characters', async () => {
    expect(await invalidFields({ ...valid, username: 'ab' })).toEqual(['username']);
  });

  it('should reject missing fields', async () => {
    expect(await invalidFields({})).toEqual(['email', 'password', 'username']);
  });
});