import { Test, TestingModule } from '@nestjs/testing';
import { CommunityService } from './community.service';
import { PrismaService } from '../../database/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import {
  UserRole,
  AuthenticatedUser,
  CommunityPostCategory,
  CommunityPostStatus,
} from '@propertyos/types';

describe('CommunityService', () => {
  let service: CommunityService;
  let prisma: any;

  const mockOrgId = 'org-111-uuid';
  const mockPropertyId = 'prop-111-uuid';
  const mockOtherPropertyId = 'prop-222-uuid';
  const mockPostId = 'post-111-uuid';
  const mockCommentId = 'comment-111-uuid';

  const mockOwnerUser: AuthenticatedUser = {
    id: 'owner-111-uuid',
    email: 'owner@propertyos.com',
    firstName: 'Rajesh',
    lastName: 'Sharma',
    roles: [UserRole.OWNER],
    organizationId: mockOrgId,
    isActive: true,
  };

  const mockManagerUser: AuthenticatedUser = {
    id: 'manager-111-uuid',
    email: 'manager@propertyos.com',
    firstName: 'Pooja',
    lastName: 'Verma',
    roles: [UserRole.PROPERTY_MANAGER],
    organizationId: mockOrgId,
    isActive: true,
  };

  const mockTenantUser: AuthenticatedUser = {
    id: 'tenant-111-uuid',
    email: 'rahul.tenant@gmail.com',
    firstName: 'Rahul',
    lastName: 'Verma',
    roles: [UserRole.TENANT],
    organizationId: mockOrgId,
    isActive: true,
  };

  const mockOtherTenantUser: AuthenticatedUser = {
    id: 'tenant-222-uuid',
    email: 'sneha.tenant@gmail.com',
    firstName: 'Sneha',
    lastName: 'Patel',
    roles: [UserRole.TENANT],
    organizationId: mockOrgId,
    isActive: true,
  };

  const mockPostData = {
    id: mockPostId,
    organizationId: mockOrgId,
    propertyId: mockPropertyId,
    authorId: mockOwnerUser.id,
    authorName: 'Rajesh Sharma',
    authorRole: UserRole.OWNER,
    tenantId: null,
    title: 'Upcoming Water Tank Cleaning',
    content: 'Water supply will be interrupted on Sunday from 10 AM to 2 PM for cleaning.',
    category: CommunityPostCategory.ANNOUNCEMENT,
    isPinned: true,
    isOfficial: true,
    status: CommunityPostStatus.PINNED,
    images: [],
    createdAt: new Date('2026-08-20T10:00:00Z'),
    updatedAt: new Date('2026-08-20T10:00:00Z'),
    deletedAt: null,
    property: {
      id: mockPropertyId,
      name: 'Green Villa PG',
    },
    comments: [],
    _count: {
      comments: 0,
    },
  };

  const mockCommentData = {
    id: mockCommentId,
    organizationId: mockOrgId,
    postId: mockPostId,
    authorId: mockTenantUser.id,
    authorName: 'Rahul Verma',
    authorRole: UserRole.TENANT,
    tenantId: 'tenant-profile-111',
    content: 'Thanks for the advance notice!',
    createdAt: new Date('2026-08-20T11:00:00Z'),
    updatedAt: new Date('2026-08-20T11:00:00Z'),
    deletedAt: null,
  };

  beforeEach(async () => {
    prisma = {
      communityPost: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      communityComment: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      property: {
        findFirst: jest.fn(),
      },
      tenant: {
        findFirst: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<CommunityService>(CommunityService);
  });

  describe('createPost', () => {
    it('should allow Owner to create an official pinned announcement', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, name: 'Green Villa PG' });
      prisma.communityPost.create.mockResolvedValue({
        ...mockPostData,
        title: 'Diwali Celebration',
        category: CommunityPostCategory.ANNOUNCEMENT,
        isPinned: true,
        isOfficial: true,
      });

      const result = await service.createPost(mockOrgId, mockOwnerUser, {
        propertyId: mockPropertyId,
        title: 'Diwali Celebration',
        content: 'Join us for Diwali dinner this Friday.',
        category: CommunityPostCategory.ANNOUNCEMENT,
        isPinned: true,
      });

      expect(result.title).toBe('Diwali Celebration');
      expect(result.isPinned).toBe(true);
      expect(result.isOfficial).toBe(true);
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should allow active Tenant to create a general resident post', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, name: 'Green Villa PG' });
      prisma.tenant.findFirst.mockResolvedValue({
        id: 'tenant-profile-111',
        checkIns: [{ propertyId: mockPropertyId }],
      });
      prisma.communityPost.create.mockResolvedValue({
        ...mockPostData,
        authorId: mockTenantUser.id,
        authorName: 'Rahul Verma',
        authorRole: UserRole.TENANT,
        tenantId: 'tenant-profile-111',
        title: 'Found Keys in Lounge',
        category: CommunityPostCategory.LOST_AND_FOUND,
        isPinned: false,
        isOfficial: false,
      });

      const result = await service.createPost(mockOrgId, mockTenantUser, {
        propertyId: mockPropertyId,
        title: 'Found Keys in Lounge',
        content: 'Found a pair of Honda bike keys on sofa.',
        category: CommunityPostCategory.LOST_AND_FOUND,
      });

      expect(result.title).toBe('Found Keys in Lounge');
      expect(result.isPinned).toBe(false);
      expect(result.isOfficial).toBe(false);
    });

    it('should reject Tenant attempting to create an ANNOUNCEMENT', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, name: 'Green Villa PG' });
      prisma.tenant.findFirst.mockResolvedValue({
        id: 'tenant-profile-111',
        checkIns: [{ propertyId: mockPropertyId }],
      });

      await expect(
        service.createPost(mockOrgId, mockTenantUser, {
          propertyId: mockPropertyId,
          title: 'Fake Official Announcement',
          content: 'This should be blocked.',
          category: CommunityPostCategory.ANNOUNCEMENT,
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject Tenant attempting to pin a post', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, name: 'Green Villa PG' });
      prisma.tenant.findFirst.mockResolvedValue({
        id: 'tenant-profile-111',
        checkIns: [{ propertyId: mockPropertyId }],
      });

      await expect(
        service.createPost(mockOrgId, mockTenantUser, {
          propertyId: mockPropertyId,
          title: 'Pinned Post Attempt',
          content: 'This should be blocked.',
          isPinned: true,
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject Tenant creating post on foreign property', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockOtherPropertyId, name: 'Other PG' });
      prisma.tenant.findFirst.mockResolvedValue({
        id: 'tenant-profile-111',
        checkIns: [{ propertyId: mockPropertyId }],
      });

      await expect(
        service.createPost(mockOrgId, mockTenantUser, {
          propertyId: mockOtherPropertyId,
          title: 'Post on other PG',
          content: 'Should fail closed.',
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent property', async () => {
      prisma.property.findFirst.mockResolvedValue(null);

      await expect(
        service.createPost(mockOrgId, mockOwnerUser, {
          propertyId: 'non-existent-prop',
          title: 'Notice',
          content: 'Some content here.',
        })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listPosts', () => {
    it('should list posts for manager with search and category filters', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId });
      prisma.communityPost.count.mockResolvedValue(1);
      prisma.communityPost.findMany.mockResolvedValue([mockPostData]);

      const result = await service.listPosts(mockOrgId, mockManagerUser, {
        propertyId: mockPropertyId,
        category: CommunityPostCategory.ANNOUNCEMENT,
        search: 'Water',
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.data[0].title).toBe('Upcoming Water Tank Cleaning');
    });

    it('should restrict Tenant to their active assigned property automatically', async () => {
      prisma.tenant.findFirst.mockResolvedValue({
        id: 'tenant-profile-111',
        checkIns: [{ propertyId: mockPropertyId }],
      });
      prisma.communityPost.count.mockResolvedValue(1);
      prisma.communityPost.findMany.mockResolvedValue([mockPostData]);

      const result = await service.listPosts(mockOrgId, mockTenantUser, {});

      expect(result.data).toHaveLength(1);
      expect(prisma.communityPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            propertyId: mockPropertyId,
          }),
        })
      );
    });

    it('should reject Tenant requesting foreign property posts', async () => {
      prisma.tenant.findFirst.mockResolvedValue({
        id: 'tenant-profile-111',
        checkIns: [{ propertyId: mockPropertyId }],
      });

      await expect(
        service.listPosts(mockOrgId, mockTenantUser, {
          propertyId: mockOtherPropertyId,
        })
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getPostDetail', () => {
    it('should return post detail with comments for manager', async () => {
      prisma.communityPost.findFirst.mockResolvedValue({
        ...mockPostData,
        comments: [mockCommentData],
      });

      const result = await service.getPostDetail(mockOrgId, mockManagerUser, mockPostId);

      expect(result.id).toBe(mockPostId);
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].content).toBe('Thanks for the advance notice!');
    });

    it('should reject Tenant accessing post belonging to foreign property', async () => {
      prisma.communityPost.findFirst.mockResolvedValue({
        ...mockPostData,
        propertyId: mockOtherPropertyId,
      });
      prisma.tenant.findFirst.mockResolvedValue({
        id: 'tenant-profile-111',
        checkIns: [{ propertyId: mockPropertyId }],
      });

      await expect(
        service.getPostDetail(mockOrgId, mockTenantUser, mockPostId)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if post not found', async () => {
      prisma.communityPost.findFirst.mockResolvedValue(null);

      await expect(
        service.getPostDetail(mockOrgId, mockOwnerUser, 'non-existent-post')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePost', () => {
    it('should allow author to update post content', async () => {
      prisma.communityPost.findFirst.mockResolvedValue({
        ...mockPostData,
        authorId: mockTenantUser.id,
      });
      prisma.communityPost.update.mockResolvedValue({
        ...mockPostData,
        title: 'Updated Water Tank Notice',
      });

      const result = await service.updatePost(mockOrgId, mockTenantUser, mockPostId, {
        title: 'Updated Water Tank Notice',
      });

      expect(result.title).toBe('Updated Water Tank Notice');
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should allow Moderator to update any post', async () => {
      prisma.communityPost.findFirst.mockResolvedValue({
        ...mockPostData,
        authorId: mockTenantUser.id,
      });
      prisma.communityPost.update.mockResolvedValue({
        ...mockPostData,
        isPinned: false,
      });

      const result = await service.updatePost(mockOrgId, mockManagerUser, mockPostId, {
        isPinned: false,
      });

      expect(result.id).toBe(mockPostId);
    });

    it('should reject non-author Tenant updating someone elses post', async () => {
      prisma.communityPost.findFirst.mockResolvedValue({
        ...mockPostData,
        authorId: mockOwnerUser.id,
      });

      await expect(
        service.updatePost(mockOrgId, mockTenantUser, mockPostId, {
          title: 'Hacked Title',
        })
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('togglePin', () => {
    it('should toggle pin status with advisory lock and write audit log', async () => {
      prisma.communityPost.findFirst.mockResolvedValue(mockPostData);
      prisma.communityPost.update.mockResolvedValue({
        ...mockPostData,
        isPinned: false,
        status: CommunityPostStatus.ACTIVE,
      });

      const result = await service.togglePin(mockOrgId, mockOwnerUser, mockPostId, false);

      expect(result.isPinned).toBe(false);
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if post not found during pin toggle', async () => {
      prisma.communityPost.findFirst.mockResolvedValue(null);

      await expect(
        service.togglePin(mockOrgId, mockOwnerUser, 'non-existent', true)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deletePost', () => {
    it('should soft-delete post and cascade to comments with audit logging', async () => {
      prisma.communityPost.findFirst.mockResolvedValue(mockPostData);
      prisma.communityPost.update.mockResolvedValue({
        ...mockPostData,
        deletedAt: new Date(),
        status: CommunityPostStatus.DELETED,
      });
      prisma.communityComment.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.deletePost(mockOrgId, mockOwnerUser, mockPostId);

      expect(result.success).toBe(true);
      expect(prisma.communityPost.update).toHaveBeenCalled();
      expect(prisma.communityComment.updateMany).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should reject non-author Tenant deleting someone elses post', async () => {
      prisma.communityPost.findFirst.mockResolvedValue({
        ...mockPostData,
        authorId: mockOwnerUser.id,
      });

      await expect(
        service.deletePost(mockOrgId, mockTenantUser, mockPostId)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createComment', () => {
    it('should allow active Tenant to add a comment', async () => {
      prisma.communityPost.findFirst.mockResolvedValue(mockPostData);
      prisma.tenant.findFirst.mockResolvedValue({
        id: 'tenant-profile-111',
        checkIns: [{ propertyId: mockPropertyId }],
      });
      prisma.communityComment.create.mockResolvedValue(mockCommentData);

      const result = await service.createComment(mockOrgId, mockTenantUser, mockPostId, {
        content: 'Thanks for the advance notice!',
      });

      expect(result.content).toBe('Thanks for the advance notice!');
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should reject comment from Tenant on foreign property post', async () => {
      prisma.communityPost.findFirst.mockResolvedValue({
        ...mockPostData,
        propertyId: mockOtherPropertyId,
      });
      prisma.tenant.findFirst.mockResolvedValue({
        id: 'tenant-profile-111',
        checkIns: [{ propertyId: mockPropertyId }],
      });

      await expect(
        service.createComment(mockOrgId, mockTenantUser, mockPostId, {
          content: 'Hello foreign PG',
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if commenting on non-existent post', async () => {
      prisma.communityPost.findFirst.mockResolvedValue(null);

      await expect(
        service.createComment(mockOrgId, mockOwnerUser, 'non-existent', {
          content: 'Testing',
        })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteComment', () => {
    it('should allow comment author to delete comment', async () => {
      prisma.communityComment.findFirst.mockResolvedValue(mockCommentData);
      prisma.communityComment.update.mockResolvedValue({
        ...mockCommentData,
        deletedAt: new Date(),
      });

      const result = await service.deleteComment(mockOrgId, mockTenantUser, mockCommentId);

      expect(result.success).toBe(true);
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should reject non-author non-moderator Tenant from deleting comment', async () => {
      prisma.communityComment.findFirst.mockResolvedValue(mockCommentData);

      await expect(
        service.deleteComment(mockOrgId, mockOtherTenantUser, mockCommentId)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getSummary', () => {
    it('should return property-scoped summary metrics', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId });
      prisma.communityPost.count.mockResolvedValueOnce(5).mockResolvedValueOnce(2);
      prisma.communityComment.count.mockResolvedValueOnce(14);

      const result = await service.getSummary(mockOrgId, mockOwnerUser, mockPropertyId);

      expect(result.propertyId).toBe(mockPropertyId);
      expect(result.activePosts).toBe(5);
      expect(result.pinnedAnnouncements).toBe(2);
      expect(result.totalComments).toBe(14);
    });

    it('should reject Tenant requesting summary of foreign property', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockOtherPropertyId });
      prisma.tenant.findFirst.mockResolvedValue({
        id: 'tenant-profile-111',
        checkIns: [{ propertyId: mockPropertyId }],
      });

      await expect(
        service.getSummary(mockOrgId, mockTenantUser, mockOtherPropertyId)
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
