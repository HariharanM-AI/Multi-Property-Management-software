import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id cryptographic hashing utility.
 * Enforces memory-hard, side-channel resistant password hashing parameters.
 */
export class CryptoUtil {
  // Argon2id configuration conforming to security standards
  private static readonly HASH_OPTIONS = {
    memoryCost: 65536, // 64 MB
    timeCost: 3,       // 3 iterations
    parallelism: 4,    // 4 threads
  };

  /**
   * Hashes a plaintext password using Argon2id.
   * @param password Plaintext password
   */
  static async hashPassword(password: string): Promise<string> {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    return hash(password, this.HASH_OPTIONS);
  }

  /**
   * Verifies a plaintext password against an Argon2id hash.
   * @param password Plaintext password
   * @param passwordHash Stored Argon2id hash
   */
  static async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    if (!password || !passwordHash) {
      return false;
    }
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }
}
