import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { TeamModule } from './modules/team/team.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { PgStructureModule } from './modules/pg-structure/pg-structure.module';
import { RentalModule } from './modules/rental/rental.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { CheckinsModule } from './modules/checkins/checkins.module';
import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { TenantOrgGuard } from './common/guards/tenant-org.guard';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: (config.get<number>('RATE_LIMIT_TTL') || 60) * 1000,
          limit: config.get<number>('RATE_LIMIT_MAX') || 100,
        },
      ],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    OrganizationsModule,
    TeamModule,
    InvitationsModule,
    PropertiesModule,
    PgStructureModule,
    RentalModule,
    TenantsModule,
    CheckinsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantOrgGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestIdInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalHttpExceptionFilter,
    },
  ],
})
export class AppModule {}
