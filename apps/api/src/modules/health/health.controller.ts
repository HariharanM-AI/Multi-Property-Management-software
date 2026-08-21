import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { HealthService, HealthCheckResult } from './health.service';
import { Public } from '../../common/decorators/roles.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  async getHealth(): Promise<HealthCheckResult> {
    return this.healthService.checkHealth();
  }

  @Public()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async getReadiness(): Promise<{ ready: boolean; timestamp: string }> {
    const health = await this.healthService.checkHealth();
    return {
      ready: health.status !== 'unhealthy',
      timestamp: health.timestamp,
    };
  }
}
