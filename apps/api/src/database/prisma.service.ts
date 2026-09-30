import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@127.0.0.1:5432/propertyos?schema=public',
        },
      },
      log: process.env.PRISMA_LOG_QUERIES === 'true' ? ['query', 'error', 'warn'] : ['error', 'warn'],
    });
  }

  // Default generous transaction timeouts for remote cloud PostgreSQL (Neon)
  override $transaction<R>(
    fn: (prisma: Prisma.TransactionClient) => Promise<R>,
    options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }
  ): Promise<R>;
  override $transaction<P extends Prisma.PrismaPromise<any>[]>(
    arg: [...P],
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel }
  ): Promise<any>;
  override $transaction(arg: any, options?: any): Promise<any> {
    if (typeof arg === 'function') {
      const mergedOptions = {
        maxWait: 15000,
        timeout: 30000,
        ...options,
      };
      return super.$transaction(arg, mergedOptions);
    }
    return super.$transaction(arg, options);
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connected successfully via Prisma');
    } catch (error) {
      this.logger.warn(`Database connection deferred or pending: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected successfully');
  }

  /**
   * Healthcheck ping
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
