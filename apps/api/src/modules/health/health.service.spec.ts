import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { PrismaService } from '../../database/prisma.service';

describe('HealthService', () => {
  let service: HealthService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: {
            isHealthy: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return healthy status when database is healthy', async () => {
    jest.spyOn(prismaService, 'isHealthy').mockResolvedValue(true);

    const result = await service.checkHealth();
    expect(result).toBeDefined();
    expect(result.services.database.status).toBe('connected');
    expect(['healthy', 'degraded']).toContain(result.status);
    expect(result.environment).toBeDefined();
  });

  it('should return unhealthy status when database is disconnected', async () => {
    jest.spyOn(prismaService, 'isHealthy').mockResolvedValue(false);

    const result = await service.checkHealth();
    expect(result.status).toBe('unhealthy');
    expect(result.services.database.status).toBe('disconnected');
  });
});
