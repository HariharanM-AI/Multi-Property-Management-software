import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { CommunityService } from './community.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission, AuthenticatedUser } from '@propertyos/types';
import {
  CreateCommunityPostSchema,
  UpdateCommunityPostSchema,
  CreateCommunityCommentSchema,
  CommunityPostQuerySchema,
  TogglePinSchema,
} from '@propertyos/validation';

@Controller('community')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  /**
   * List community posts with filtering, search, and pagination.
   */
  @Get('posts')
  @RequirePermissions(Permission.COMMUNITY_READ)
  async listPosts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    const parseResult = CommunityPostQuerySchema.safeParse(query);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    return this.communityService.listPosts(user.organizationId, user, parseResult.data);
  }

  /**
   * Get property-scoped summary metrics.
   */
  @Get('summary')
  @RequirePermissions(Permission.COMMUNITY_READ)
  async getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('propertyId') propertyId: string
  ) {
    if (!propertyId) {
      throw new BadRequestException('propertyId query parameter is required');
    }

    return this.communityService.getSummary(user.organizationId, user, propertyId);
  }

  /**
   * Get single post detail including comments.
   */
  @Get('posts/:id')
  @RequirePermissions(Permission.COMMUNITY_READ)
  async getPostDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    return this.communityService.getPostDetail(user.organizationId, user, id);
  }

  /**
   * Create a new community post.
   */
  @Post('posts')
  @RequirePermissions(Permission.COMMUNITY_POST_CREATE)
  async createPost(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    const parseResult = CreateCommunityPostSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    return this.communityService.createPost(user.organizationId, user, parseResult.data);
  }

  /**
   * Update an existing post.
   */
  @Patch('posts/:id')
  @RequirePermissions(Permission.COMMUNITY_POST_UPDATE)
  async updatePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: any
  ) {
    const parseResult = UpdateCommunityPostSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    return this.communityService.updatePost(user.organizationId, user, id, parseResult.data);
  }

  /**
   * Pin or unpin a post (Moderator only).
   */
  @Patch('posts/:id/pin')
  @RequirePermissions(Permission.COMMUNITY_MODERATE)
  async togglePin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: any
  ) {
    const parseResult = TogglePinSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    return this.communityService.togglePin(user.organizationId, user, id, parseResult.data.isPinned);
  }

  /**
   * Soft delete a community post.
   */
  @Delete('posts/:id')
  @RequirePermissions(Permission.COMMUNITY_DELETE)
  async deletePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    return this.communityService.deletePost(user.organizationId, user, id);
  }

  /**
   * Add a comment to a community post.
   */
  @Post('posts/:id/comments')
  @RequirePermissions(Permission.COMMUNITY_COMMENT_CREATE)
  async createComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: any
  ) {
    const parseResult = CreateCommunityCommentSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    return this.communityService.createComment(user.organizationId, user, id, parseResult.data);
  }

  /**
   * Soft delete a comment.
   */
  @Delete('comments/:id')
  @RequirePermissions(Permission.COMMUNITY_DELETE)
  async deleteComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    return this.communityService.deleteComment(user.organizationId, user, id);
  }
}
