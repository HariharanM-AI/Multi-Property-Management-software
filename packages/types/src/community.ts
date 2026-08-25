// ==============================================================================
// PropertyOS — Community & Notice Board Domain Types (CORE-025)
// ==============================================================================

import { UserRole } from './auth';

export enum CommunityPostCategory {
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  MAINTENANCE = 'MAINTENANCE',
  EVENT = 'EVENT',
  RULE = 'RULE',
  LOST_AND_FOUND = 'LOST_AND_FOUND',
  GENERAL = 'GENERAL',
}

export enum CommunityPostStatus {
  ACTIVE = 'ACTIVE',
  PINNED = 'PINNED',
  ARCHIVED = 'ARCHIVED',
  FLAGGED = 'FLAGGED',
  DELETED = 'DELETED',
}

export interface CommunityCommentDto {
  id: string;
  organizationId: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  tenantId?: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityPostDto {
  id: string;
  organizationId: string;
  propertyId: string;
  propertyName?: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  tenantId?: string | null;
  title: string;
  content: string;
  category: CommunityPostCategory;
  isPinned: boolean;
  isOfficial: boolean;
  status: CommunityPostStatus;
  images: string[];
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityPostDetailDto extends CommunityPostDto {
  comments: CommunityCommentDto[];
}

export interface CreateCommunityPostDto {
  propertyId: string;
  title: string;
  content: string;
  category?: CommunityPostCategory;
  isPinned?: boolean;
  images?: string[];
}

export interface UpdateCommunityPostDto {
  title?: string;
  content?: string;
  category?: CommunityPostCategory;
  isPinned?: boolean;
  images?: string[];
}

export interface CreateCommunityCommentDto {
  content: string;
}

export interface CommunityPostQuery {
  propertyId?: string;
  category?: CommunityPostCategory;
  isPinned?: boolean | string;
  search?: string;
  page?: number | string;
  limit?: number | string;
}

export interface PaginatedCommunityPostsDto {
  data: CommunityPostDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CommunitySummaryDto {
  propertyId: string;
  activePosts: number;
  pinnedAnnouncements: number;
  totalComments: number;
}
