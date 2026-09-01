import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

@Injectable()
export class JobsRedisProvider implements OnApplicationShutdown {
  private readonly logger = new Logger(JobsRedisProvider.name);
  private redisClient: Redis | null = null;
  private readonly connectionOptions: RedisOptions;

  constructor(private readonly configService: ConfigService) {
    this.connectionOptions = this.buildRedisOptions();
  }

  /**
   * Resolves connection options compatible with BullMQ 5.x.
   * Crucial: maxRetriesPerRequest MUST be null for BullMQ workers and queues.
   */
  private buildRedisOptions(): RedisOptions {
    const rawUrl = this.configService.get<string>('REDIS_URL') || process.env.REDIS_URL;

    if (rawUrl && rawUrl.startsWith('redis://')) {
      try {
        const parsed = new URL(rawUrl);
        return {
          host: parsed.hostname || '127.0.0.1',
          port: parsed.port ? parseInt(parsed.port, 10) : 6379,
          password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
          username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          retryStrategy: (times: number) => Math.min(times * 100, 3000),
          lazyConnect: false,
        };
      } catch (err: any) {
        this.logger.warn(`Failed parsing REDIS_URL (${rawUrl}): ${err.message}. Falling back to default host/port.`);
      }
    }

    const host =
      this.configService.get<string>('REDIS_HOST') || process.env.REDIS_HOST || '127.0.0.1';
    const port =
      Number(this.configService.get<number>('REDIS_PORT') || process.env.REDIS_PORT) || 6379;
    const password =
      this.configService.get<string>('REDIS_PASSWORD') || process.env.REDIS_PASSWORD || undefined;

    return {
      host,
      port,
      password,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times: number) => {
        if (times > 2) return null; // do not loop infinitely if Redis is offline
        return Math.min(times * 200, 1000);
      },
      lazyConnect: true,
      enableOfflineQueue: false,
    };
  }

  /**
   * Returns BullMQ-compatible connection options object
   */
  public getRedisOptions(): RedisOptions {
    return { ...this.connectionOptions };
  }

  /**
   * Returns a standalone ioredis client instance for metrics and ping health checks
   */
  public getClient(): Redis {
    if (!this.redisClient) {
      this.redisClient = new Redis({
        ...this.getRedisOptions(),
        retryStrategy: (times) => (times > 2 ? null : 1000),
      });
      this.redisClient.on('error', (err) => {
        this.logger.debug?.(`Redis client status: ${err.message}`);
      });
    }
    return this.redisClient;
  }

  /**
   * Fast Redis ping check
   */
  public async isHealthy(): Promise<boolean> {
    try {
      const testClient = new Redis({
        ...this.getRedisOptions(),
        maxRetriesPerRequest: 1,
        connectTimeout: 500,
        retryStrategy: () => null,
      });
      testClient.on('error', () => {});
      const pingPromise = testClient.ping();
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 500)
      );
      const res = await Promise.race([pingPromise, timeoutPromise]);
      testClient.disconnect();
      return res === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Graceful shutdown hook for the Redis client
   */
  public async onApplicationShutdown(): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch (err: any) {
        this.logger.warn(`Error closing Redis client: ${err.message}`);
      } finally {
        this.redisClient = null;
      }
    }
  }
}
