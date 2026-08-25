import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, UserRoleType } from '@prisma/client';
import {
  AuthenticatedUser,
  UserRole,
  CommunityPostCategory,
  CommunityPostStatus,
  CommunityPostDto,
  CommunityPostDetailDto,
  CommunityCommentDto,
  CreateCommunityPostDto,
  UpdateCommunityPostDto,
  CreateCommunityCommentDto,
  CommunityPostQuery,
  PaginatedCommunityPostsDto,
  CommunitySummaryDto,
} from '@propertyos/types';

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  private isTenantOnly(caller: AuthenticatedUser): boolean {
    return (
      caller.roles.includes(UserRole.TENANT) &&
      !caller.roles.includes(UserRole.OWNER) &&
      !caller.roles.includes(UserRole.PROPERTY_MANAGER) &&
      !caller.roles.includes(UserRole.WARDEN)
    );
  }

  private isModerator(caller: AuthenticatedUser): boolean {
    return (
      caller.roles.includes(UserRole.OWNER) ||
      caller.roles.includes(UserRole.PROPERTY_MANAGER) ||
      caller.roles.includes(UserRole.WARDEN)
    );
  }

  /**
   * Helper to resolve active tenant and assigned property for a user.
   */
  async getActiveTenantPropertyForUser(
    organizationId: string,
    user: AuthenticatedUser
  ): Promise<{ tenantId: string; propertyId: string } | null> {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        organizationId,
        OR: [
          ...(user.email ? [{ email: user.email }] : []),
          ...(user.phone ? [{ phone: user.phone }] : []),
        ],
        deletedAt: null,
      },
      include: {
        checkIns: {
          where: {
            status: 'CHECKED_IN',
          },
          select: {
            propertyId: true,
          },
          take: 1,
        },
        leases: {
          where: {
            status: 'ACTIVE',
          },
          include: {
            rentalUnit: {
              select: {
                propertyId: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!tenant) return null;

    let propertyId: string | null = null;
    if (tenant.checkIns && tenant.checkIns.length > 0) {
      propertyId = tenant.checkIns[0].propertyId;
    } else if (tenant.leases && tenant.leases.length > 0 && tenant.leases[0].rentalUnit) {
      propertyId = tenant.leases[0].rentalUnit.propertyId;
    }

    if (!propertyId) return null;

    return {
      tenantId: tenant.id,
      propertyId,
    };
  }

  /**
   * Helper to write structured audit logs.
   */
  private async writeAuditLog(
    tx: Prisma.TransactionClient,
    organizationId: string,
    userId: string | null | undefined,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        organizationId,
        userId: userId || null,
        action,
        resourceType,
        resourceId,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  }

  /**
   * Map raw Prisma Post record to CommunityPostDto.
   */
  private mapPostToDto(post: any): CommunityPostDto {
    return {
      id: post.id,
      organizationId: post.organizationId,
      propertyId: post.propertyId,
      propertyName: post.property?.name,
      authorId: post.authorId,
      authorName: post.authorName,
      authorRole: post.authorRole as UserRole,
      tenantId: post.tenantId,
      title: post.title,
      content: post.content,
      category: post.category as CommunityPostCategory,
      isPinned: post.isPinned,
      isOfficial: post.isOfficial,
      status: post.status as CommunityPostStatus,
      images: post.images || [],
      commentCount: post._count ? post._count.comments : (post.comments ? post.comments.length : 0),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }

  /**
   * Map raw Prisma Comment record to CommunityCommentDto.
   */
  private mapCommentToDto(comment: any): CommunityCommentDto {
    return {
      id: comment.id,
      organizationId: comment.organizationId,
      postId: comment.postId,
      authorId: comment.authorId,
      authorName: comment.authorName,
      authorRole: comment.authorRole as UserRole,
      tenantId: comment.tenantId,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    };
  }

  /**
   * List community posts with filtering, search, pagination, and multi-tenant isolation.
   */
  async listPosts(
    organizationId: string,
    caller: AuthenticatedUser,
    query: CommunityPostQuery
  ): Promise<PaginatedCommunityPostsDto> {
    let targetPropertyId = query.propertyId;

    if (this.isTenantOnly(caller)) {
      const activeTenant = await this.getActiveTenantPropertyForUser(organizationId, caller);
      if (!activeTenant) {
        return {
          data: [],
          meta: {
            total: 0,
            page: query.page ? Number(query.page) : 1,
            limit: query.limit ? Number(query.limit) : 20,
            totalPages: 0,
          },
        };
      }

      if (targetPropertyId && targetPropertyId !== activeTenant.propertyId) {
        throw new ForbiddenException('Tenants can only access community posts for their assigned property');
      }

      targetPropertyId = activeTenant.propertyId;
    } else if (targetPropertyId) {
      const property = await this.prisma.property.findFirst({
        where: {
          id: targetPropertyId,
          organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!property) {
        throw new NotFoundException('Property not found');
      }
    }

    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;
    const skip = (page - 1) * limit;

    const isPinnedFilter =
      query.isPinned !== undefined
        ? query.isPinned === true || query.isPinned === 'true'
        : undefined;

    const where: Prisma.CommunityPostWhereInput = {
      organizationId,
      deletedAt: null,
      ...(targetPropertyId ? { propertyId: targetPropertyId } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(isPinnedFilter !== undefined ? { isPinned: isPinnedFilter } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { content: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, posts] = await Promise.all([
      this.prisma.communityPost.count({ where }),
      this.prisma.communityPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        include: {
          property: {
            select: { name: true },
          },
          _count: {
            select: {
              comments: {
                where: { deletedAt: null },
              },
            },
          },
        },
      }),
    ]);

    return {
      data: posts.map((p) => this.mapPostToDto(p)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single post detail including threaded comments.
   */
  async getPostDetail(
    organizationId: string,
    caller: AuthenticatedUser,
    postId: string
  ): Promise<CommunityPostDetailDto> {
    const post = await this.prisma.communityPost.findFirst({
      where: {
        id: postId,
        organizationId,
        deletedAt: null,
      },
      include: {
        property: {
          select: { name: true },
        },
        comments: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Community post not found');
    }

    if (this.isTenantOnly(caller)) {
      const activeTenant = await this.getActiveTenantPropertyForUser(organizationId, caller);
      if (!activeTenant || activeTenant.propertyId !== post.propertyId) {
        throw new ForbiddenException('Access denied to community post on foreign property');
      }
    }

    const postDto = this.mapPostToDto(post);
    const commentsDto = post.comments.map((c) => this.mapCommentToDto(c));

    return {
      ...postDto,
      comments: commentsDto,
    };
  }

  /**
   * Create a community post.
   */
  async createPost(
    organizationId: string,
    caller: AuthenticatedUser,
    input: CreateCommunityPostDto
  ): Promise<CommunityPostDto> {
    const property = await this.prisma.property.findFirst({
      where: {
        id: input.propertyId,
        organizationId,
        deletedAt: null,
      },
      select: { id: true, name: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    let tenantId: string | null = null;
    let isOfficial = false;
    let isPinned = false;
    let category = input.category || CommunityPostCategory.GENERAL;

    if (this.isTenantOnly(caller)) {
      const activeTenant = await this.getActiveTenantPropertyForUser(organizationId, caller);
      if (!activeTenant || activeTenant.propertyId !== input.propertyId) {
        throw new ForbiddenException('Tenants can only create posts for their assigned property with an active stay');
      }

      tenantId = activeTenant.tenantId;

      if (input.isPinned) {
        throw new ForbiddenException('Tenants cannot pin posts');
      }

      if (category === CommunityPostCategory.ANNOUNCEMENT) {
        throw new ForbiddenException('Only management staff can create official announcements');
      }
    } else {
      isPinned = !!input.isPinned;
      isOfficial = this.isModerator(caller)
        ? category === CommunityPostCategory.ANNOUNCEMENT || isPinned
        : false;
    }

    const authorName = `${caller.firstName || ''} ${caller.lastName || ''}`.trim() || caller.email;
    const authorRole = (caller.roles[0] || UserRole.TENANT) as UserRoleType;

    return this.prisma.$transaction(async (tx) => {
      const post = await tx.communityPost.create({
        data: {
          organizationId,
          propertyId: input.propertyId,
          authorId: caller.id,
          authorName,
          authorRole,
          tenantId,
          title: input.title,
          content: input.content,
          category,
          isPinned,
          isOfficial,
          status: isPinned ? CommunityPostStatus.PINNED : CommunityPostStatus.ACTIVE,
          images: input.images || [],
        },
        include: {
          property: {
            select: { name: true },
          },
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        caller.id,
        'COMMUNITY_POST_CREATED',
        'COMMUNITY_POST',
        post.id,
        {
          propertyId: input.propertyId,
          category: post.category,
          isPinned: post.isPinned,
          isOfficial: post.isOfficial,
          title: post.title,
        }
      );

      return this.mapPostToDto(post);
    });
  }

  /**
   * Update an existing community post.
   */
  async updatePost(
    organizationId: string,
    caller: AuthenticatedUser,
    postId: string,
    input: UpdateCommunityPostDto
  ): Promise<CommunityPostDto> {
    const post = await this.prisma.communityPost.findFirst({
      where: {
        id: postId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!post) {
      throw new NotFoundException('Community post not found');
    }

    const isAuthor = post.authorId === caller.id;
    const isModerator = this.isModerator(caller);

    if (!isAuthor && !isModerator) {
      throw new ForbiddenException('You do not have permission to update this post');
    }

    if (this.isTenantOnly(caller)) {
      if (!isAuthor) {
        throw new ForbiddenException('Tenants can only update their own posts');
      }
      if (input.isPinned !== undefined && input.isPinned !== post.isPinned) {
        throw new ForbiddenException('Tenants cannot modify pin status');
      }
      if (input.category === CommunityPostCategory.ANNOUNCEMENT) {
        throw new ForbiddenException('Tenants cannot change category to announcement');
      }
    }

    const updateData: Prisma.CommunityPostUpdateInput = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.content !== undefined) updateData.content = input.content;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.images !== undefined) updateData.images = input.images;
    if (input.isPinned !== undefined && isModerator) {
      updateData.isPinned = input.isPinned;
      updateData.status = input.isPinned ? CommunityPostStatus.PINNED : CommunityPostStatus.ACTIVE;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.communityPost.update({
        where: { id: postId },
        data: updateData,
        include: {
          property: {
            select: { name: true },
          },
          _count: {
            select: {
              comments: { where: { deletedAt: null } },
            },
          },
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        caller.id,
        'COMMUNITY_POST_UPDATED',
        'COMMUNITY_POST',
        postId,
        {
          propertyId: updated.propertyId,
          isPinned: updated.isPinned,
          category: updated.category,
        }
      );

      return this.mapPostToDto(updated);
    });
  }

  /**
   * Pin or unpin a community post with transaction-scoped PostgreSQL advisory locking.
   */
  async togglePin(
    organizationId: string,
    caller: AuthenticatedUser,
    postId: string,
    isPinned: boolean
  ): Promise<CommunityPostDto> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Transaction-scoped PostgreSQL advisory lock
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('community_pin_' || ${postId}))`;

      // 2. Fetch active post
      const post = await tx.communityPost.findFirst({
        where: {
          id: postId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!post) {
        throw new NotFoundException('Community post not found');
      }

      // 3. Update pin status
      const updated = await tx.communityPost.update({
        where: { id: postId },
        data: {
          isPinned,
          status: isPinned ? CommunityPostStatus.PINNED : CommunityPostStatus.ACTIVE,
        },
        include: {
          property: {
            select: { name: true },
          },
          _count: {
            select: {
              comments: { where: { deletedAt: null } },
            },
          },
        },
      });

      // 4. Audit Log
      await this.writeAuditLog(
        tx,
        organizationId,
        caller.id,
        isPinned ? 'COMMUNITY_POST_PINNED' : 'COMMUNITY_POST_UNPINNED',
        'COMMUNITY_POST',
        postId,
        {
          propertyId: updated.propertyId,
          isPinned,
        }
      );

      return this.mapPostToDto(updated);
    });
  }

  /**
   * Soft delete a community post and cascade soft delete to its comments.
   */
  async deletePost(
    organizationId: string,
    caller: AuthenticatedUser,
    postId: string
  ): Promise<{ success: boolean; message: string }> {
    return this.prisma.$transaction(async (tx) => {
      // Advisory lock on post deletion
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('community_pin_' || ${postId}))`;

      const post = await tx.communityPost.findFirst({
        where: {
          id: postId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!post) {
        throw new NotFoundException('Community post not found');
      }

      const isAuthor = post.authorId === caller.id;
      const isModerator = this.isModerator(caller);

      if (!isAuthor && !isModerator) {
        throw new ForbiddenException('You do not have permission to delete this post');
      }

      const now = new Date();

      // Soft delete post
      await tx.communityPost.update({
        where: { id: postId },
        data: {
          deletedAt: now,
          status: CommunityPostStatus.DELETED,
        },
      });

      // Cascade soft delete to associated comments
      await tx.communityComment.updateMany({
        where: {
          postId,
          deletedAt: null,
        },
        data: {
          deletedAt: now,
        },
      });

      // Audit Log
      await this.writeAuditLog(
        tx,
        organizationId,
        caller.id,
        'COMMUNITY_POST_DELETED',
        'COMMUNITY_POST',
        postId,
        {
          propertyId: post.propertyId,
          deletedByRole: caller.roles[0],
        }
      );

      return {
        success: true,
        message: 'Community post deleted successfully',
      };
    });
  }

  /**
   * Add a comment to an active community post.
   */
  async createComment(
    organizationId: string,
    caller: AuthenticatedUser,
    postId: string,
    input: CreateCommunityCommentDto
  ): Promise<CommunityCommentDto> {
    const post = await this.prisma.communityPost.findFirst({
      where: {
        id: postId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!post) {
      throw new NotFoundException('Community post not found or has been deleted');
    }

    let tenantId: string | null = null;
    if (this.isTenantOnly(caller)) {
      const activeTenant = await this.getActiveTenantPropertyForUser(organizationId, caller);
      if (!activeTenant || activeTenant.propertyId !== post.propertyId) {
        throw new ForbiddenException('Tenants can only comment on community posts of their assigned property');
      }
      tenantId = activeTenant.tenantId;
    }

    const authorName = `${caller.firstName || ''} ${caller.lastName || ''}`.trim() || caller.email;
    const authorRole = (caller.roles[0] || UserRole.TENANT) as UserRoleType;

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.communityComment.create({
        data: {
          organizationId,
          postId,
          authorId: caller.id,
          authorName,
          authorRole,
          tenantId,
          content: input.content,
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        caller.id,
        'COMMUNITY_COMMENT_CREATED',
        'COMMUNITY_COMMENT',
        comment.id,
        {
          postId,
          propertyId: post.propertyId,
        }
      );

      return this.mapCommentToDto(comment);
    });
  }

  /**
   * Soft delete a comment.
   */
  async deleteComment(
    organizationId: string,
    caller: AuthenticatedUser,
    commentId: string
  ): Promise<{ success: boolean; message: string }> {
    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.communityComment.findFirst({
        where: {
          id: commentId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!comment) {
        throw new NotFoundException('Comment not found');
      }

      const isAuthor = comment.authorId === caller.id;
      const isModerator = this.isModerator(caller);

      if (!isAuthor && !isModerator) {
        throw new ForbiddenException('You do not have permission to delete this comment');
      }

      await tx.communityComment.update({
        where: { id: commentId },
        data: { deletedAt: new Date() },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        caller.id,
        'COMMUNITY_COMMENT_DELETED',
        'COMMUNITY_COMMENT',
        commentId,
        {
          postId: comment.postId,
          deletedByRole: caller.roles[0],
        }
      );

      return {
        success: true,
        message: 'Comment deleted successfully',
      };
    });
  }

  /**
   * Get property-scoped summary metrics.
   */
  async getSummary(
    organizationId: string,
    caller: AuthenticatedUser,
    propertyId: string
  ): Promise<CommunitySummaryDto> {
    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (this.isTenantOnly(caller)) {
      const activeTenant = await this.getActiveTenantPropertyForUser(organizationId, caller);
      if (!activeTenant || activeTenant.propertyId !== propertyId) {
        throw new ForbiddenException('Tenants can only access summary metrics for their assigned property');
      }
    }

    const [activePosts, pinnedAnnouncements, totalComments] = await Promise.all([
      this.prisma.communityPost.count({
        where: {
          organizationId,
          propertyId,
          deletedAt: null,
        },
      }),
      this.prisma.communityPost.count({
        where: {
          organizationId,
          propertyId,
          isPinned: true,
          deletedAt: null,
        },
      }),
      this.prisma.communityComment.count({
        where: {
          organizationId,
          post: {
            propertyId,
            deletedAt: null,
          },
          deletedAt: null,
        },
      }),
    ]);

    return {
      propertyId,
      activePosts,
      pinnedAnnouncements,
      totalComments,
    };
  }
}
