import { CryptoUtil } from './crypto.util';

describe('CryptoUtil (Argon2id)', () => {
  it('should successfully hash a valid password using Argon2id', async () => {
    const password = 'StrongPassword123!';
    const hash = await CryptoUtil.hashPassword(password);

    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash).toContain('$argon2id$');
  });

  it('should successfully verify matching password against hash', async () => {
    const password = 'SecurePassword2026@#$';
    const hash = await CryptoUtil.hashPassword(password);

    const isValid = await CryptoUtil.verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect password against hash', async () => {
    const password = 'CorrectPassword123!';
    const hash = await CryptoUtil.hashPassword(password);

    const isValid = await CryptoUtil.verifyPassword('WrongPassword123!', hash);
    expect(isValid).toBe(false);
  });

  it('should throw error when hashing a password shorter than 8 characters', async () => {
    await expect(CryptoUtil.hashPassword('short')).rejects.toThrow(
      'Password must be at least 8 characters long'
    );
  });
});
