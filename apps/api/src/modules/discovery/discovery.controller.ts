import {
  Controller,
  Get,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { PropertyDiscoveryQuerySchema } from '@propertyos/validation';
import { Public } from '../../common/decorators/roles.decorator';

@Public()
@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  /**
   * Public discovery endpoint for searching active discoverable properties
   */
  @Public()
  @Get()
  async searchProperties(@Query() query: any) {
    const parseResult = PropertyDiscoveryQuerySchema.safeParse(query);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid discovery search query filters',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const result = await this.discoveryService.searchProperties(parseResult.data);
    return {
      success: true,
      data: result.items,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Public endpoint returning distinct active discovery cities and locality counts
   */
  @Public()
  @Get('cities')
  async getDiscoveryCities() {
    const data = await this.discoveryService.getDiscoveryCities();
    return {
      success: true,
      data,
    };
  }

  /**
   * Public endpoint returning curated active featured properties
   */
  @Public()
  @Get('featured')
  async getFeaturedProperties(@Query('limit') limit?: string) {
    const parsedLimit = limit ? Math.min(20, Math.max(1, parseInt(limit, 10))) : 6;
    const data = await this.discoveryService.getFeaturedProperties(parsedLimit);
    return {
      success: true,
      data,
    };
  }

  /**
   * Public endpoint returning full discovery profile for a single active property
   */
  @Public()
  @Get(':id')
  async getDiscoveryDetailById(@Param('id') id: string) {
    const data = await this.discoveryService.getDiscoveryDetailById(id);
    return {
      success: true,
      data,
    };
  }
}
