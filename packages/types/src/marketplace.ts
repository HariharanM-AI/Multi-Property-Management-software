import { UserRole } from './auth.js';

export enum MarketplaceCategory {
  FURNITURE = 'FURNITURE',
  ELECTRONICS = 'ELECTRONICS',
  APPLIANCES = 'APPLIANCES',
  BOOKS = 'BOOKS',
  VEHICLES = 'VEHICLES',
  CLOTHING = 'CLOTHING',
  SPORTS = 'SPORTS',
  OTHER = 'OTHER',
}

export enum MarketplaceItemCondition {
  BRAND_NEW = 'BRAND_NEW',
  LIKE_NEW = 'LIKE_NEW',
  GOOD = 'GOOD',
  FAIR = 'FAIR',
  POOR = 'POOR',
}

export enum MarketplaceListingStatus {
  ACTIVE = 'ACTIVE',
  RESERVED = 'RESERVED',
  SOLD = 'SOLD',
  EXPIRED = 'EXPIRED',
  DELETED = 'DELETED',
}

export interface MarketplaceListingDto {
  id: string;
  organizationId: string;
  propertyId: string;
  propertyName?: string;
  sellerId: string;
  sellerName: string;
  sellerRole: UserRole;
  sellerPhone: string | null;
  tenantId: string | null;
  title: string;
  description: string;
  price: string;
  isNegotiable: boolean;
  category: MarketplaceCategory;
  condition: MarketplaceItemCondition;
  status: MarketplaceListingStatus;
  images: string[];
  locationNote: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateMarketplaceListingDto {
  propertyId: string;
  title: string;
  description: string;
  price: number | string;
  isNegotiable?: boolean;
  category: MarketplaceCategory;
  condition: MarketplaceItemCondition;
  images?: string[];
  locationNote?: string;
  contactPhone?: string;
}

export interface UpdateMarketplaceListingDto {
  title?: string;
  description?: string;
  price?: number | string;
  isNegotiable?: boolean;
  category?: MarketplaceCategory;
  condition?: MarketplaceItemCondition;
  images?: string[];
  locationNote?: string;
  contactPhone?: string;
}

export interface UpdateMarketplaceStatusDto {
  status: MarketplaceListingStatus.ACTIVE | MarketplaceListingStatus.RESERVED | MarketplaceListingStatus.SOLD;
}

export enum MarketplaceSortBy {
  NEWEST = 'NEWEST',
  PRICE_ASC = 'PRICE_ASC',
  PRICE_DESC = 'PRICE_DESC',
}

export interface MarketplaceListingQuery {
  page?: number;
  limit?: number;
  propertyId?: string;
  category?: MarketplaceCategory;
  condition?: MarketplaceItemCondition;
  status?: MarketplaceListingStatus;
  minPrice?: number;
  maxPrice?: number;
  isNegotiable?: boolean;
  search?: string;
  sellerId?: string;
  sortBy?: MarketplaceSortBy;
}

export interface PaginatedMarketplaceListingsDto {
  data: MarketplaceListingDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MarketplaceSummaryDto {
  propertyId?: string;
  activeListings: number;
  soldListings: number;
  reservedListings: number;
  totalActiveValue: string;
  categoryBreakdown: Record<string, number>;
}
