import { PropertyType, PropertyStatus } from './index';
import { PropertyCapability } from './capabilities';

export interface PropertyLocationDto {
  address: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  locality?: string | null;
  city: string;
  district?: string | null;
  state: string;
  country: string;
  postalCode: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface AmenityDto {
  id: string;
  name: string;
  category?: string | null;
  icon?: string | null;
}

export interface PropertyMediaDto {
  id: string;
  propertyId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  category: string;
  createdAt: string | Date;
}

export interface PropertyDto {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  propertyType: PropertyType;
  status: PropertyStatus;
  description?: string | null;
  address: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  locality?: string | null;
  city: string;
  district?: string | null;
  state: string;
  country: string;
  postalCode: string;
  latitude?: number | null;
  longitude?: number | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  ownerName?: string | null;
  ownerAddress?: string | null;
  ownerPhone?: string | null;
  ownerSignature?: string | null;
  noticePeriodDays?: number | null;
  lockInPeriodValue?: number | null;
  lockInPeriodUnit?: 'DAYS' | 'MONTHS' | 'YEARS' | null;
  lockInMonths?: number | null;
  images: string[];
  amenities?: AmenityDto[];
  media?: PropertyMediaDto[];
  capabilities: PropertyCapability[];
  createdAt: string | Date;
  updatedAt: string | Date;
  deletedAt?: string | Date | null;
}

export interface CreatePropertyDto {
  name: string;
  propertyType: PropertyType;
  description?: string | null;
  address: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  locality?: string | null;
  city: string;
  district?: string | null;
  state: string;
  country?: string;
  postalCode: string;
  latitude?: number | null;
  longitude?: number | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  ownerName?: string | null;
  ownerAddress?: string | null;
  ownerPhone?: string | null;
  ownerSignature?: string | null;
  noticePeriodDays?: number | null;
  lockInPeriodValue?: number | null;
  lockInPeriodUnit?: 'DAYS' | 'MONTHS' | 'YEARS' | null;
  lockInMonths?: number | null;
  amenityIds?: string[];
}

export interface UpdatePropertyDto {
  name?: string;
  status?: PropertyStatus;
  description?: string | null;
  address?: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  locality?: string | null;
  city?: string;
  district?: string | null;
  state?: string;
  country?: string;
  postalCode?: string;
  latitude?: number | null;
  longitude?: number | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  ownerName?: string | null;
  ownerAddress?: string | null;
  ownerPhone?: string | null;
  ownerSignature?: string | null;
  noticePeriodDays?: number | null;
  lockInPeriodValue?: number | null;
  lockInPeriodUnit?: 'DAYS' | 'MONTHS' | 'YEARS' | null;
  lockInMonths?: number | null;
  amenityIds?: string[];
}

export interface PropertyFilterDto {
  page?: number;
  pageSize?: number;
  propertyType?: PropertyType;
  status?: PropertyStatus;
  city?: string;
  state?: string;
  search?: string;
}

export interface PaginatedPropertiesDto {
  items: PropertyDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
