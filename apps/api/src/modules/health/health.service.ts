import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import Redis from 'ioredis';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  services: {
    database: {
      status: 'connected' | 'disconnected' | 'disabled';
      message?: string;
    };
    redis: {
      status: 'connected' | 'disconnected' | 'disabled';
      message?: string;
    };
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private redisClient: Redis | null = null;

  constructor(private readonly prisma: PrismaService) {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        this.redisClient = new Redis(redisUrl, {
          lazyConnect: true,
          connectTimeout: 2000,
          maxRetriesPerRequest: 1,
          retryStrategy: () => null, // Do not spam retries if offline during local tests
        });
      } catch (err) {
        this.logger.warn(`Redis initialization skipped: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const dbHealthy = await this.prisma.isHealthy();
    let redisHealthy = false;

    if (this.redisClient) {
      try {
        if (this.redisClient.status !== 'ready') {
          await this.redisClient.connect();
        }
        const pong = await this.redisClient.ping();
        redisHealthy = pong === 'PONG';
      } catch {
        redisHealthy = false;
      }
    }

    const isHealthy = dbHealthy;
    const status: 'healthy' | 'degraded' | 'unhealthy' =
      dbHealthy && (redisHealthy || !this.redisClient)
        ? 'healthy'
        : dbHealthy
          ? 'degraded'
          : 'unhealthy';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: {
          status: dbHealthy ? 'connected' : 'disconnected',
        },
        redis: {
          status: this.redisClient
            ? redisHealthy
              ? 'connected'
              : 'disconnected'
            : 'disabled',
        },
      },
    };
  }
}
