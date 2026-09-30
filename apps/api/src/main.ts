import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dns from 'node:dns/promises';

async function resolveNeonDatabaseUrl(): Promise<void> {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname.includes('neon.tech')) {
      const endpoint = parsed.hostname.split('.')[0];
      const ips = await dns.resolve4(parsed.hostname);
      if (ips && ips.length > 0) {
        parsed.hostname = ips[0];
        if (!parsed.port) parsed.port = '5432';
        if (!parsed.searchParams.has('options')) {
          parsed.searchParams.set('options', `endpoint=${endpoint}`);
        }
        process.env.DATABASE_URL = parsed.toString();
        new Logger('NeonDnsResolver').log(
          `Resolved Neon cloud host to IPv4 ${ips[0]} with endpoint ${endpoint} (IPv6 bypass enabled)`
        );
      }
    }
  } catch (err) {
    new Logger('NeonDnsResolver').warn(
      `Could not pre-resolve Neon host: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

async function bootstrap() {
  await resolveNeonDatabaseUrl();
  const logger = new Logger('PropertyOS-Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production' ? ['error', 'warn', 'log'] : ['log', 'debug', 'error', 'warn'],
  });

  // 1. Security Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // 2. Cookie Parser for secure HTTP-only cookie sessions
  const cookieMiddleware = (cookieParser as unknown as { default?: typeof cookieParser }).default || cookieParser;
  app.use(cookieMiddleware(process.env.SESSION_SECRET || 'local-dev-session-cookie-secret'));

  // 3. CORS Configuration (No wildcards in production)
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000';
  const allowedOrigins = allowedOriginsEnv.split(',').map((origin) => origin.trim());

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server) or in allowed list
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-request-id', 'Cache-Control', 'Pragma', 'cache-control', 'pragma'],
  });

  // 4. API Global Prefix
  app.setGlobalPrefix('api/v1');

  // 5. Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // 6. Enable Graceful Shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  logger.log(`PropertyOS API running at http://localhost:${port}/api/v1`);
}

bootstrap().catch((err) => {
  console.error('Fatal error bootstrapping PropertyOS API:', err);
  process.exit(1);
});
