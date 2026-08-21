import { UserRole } from './auth';

// ==============================================================================
// Organization, Team & Invitation Interfaces
// ==============================================================================

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export interface OrganizationDto {
  id: string;
  name: string;
  legalName?: string | null;
  taxIdGst?: string | null;
  phone?: string | null;
  email?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  memberCount?: number;
  propertyCount?: number;
}

export interface UpdateOrganizationDto {
  name?: string;
  legalName?: string | null;
  taxIdGst?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface TeamMemberDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  isActive: boolean;
  roles: UserRole[];
  lastLoginAt?: string | Date | null;
  createdAt: string | Date;
}

export interface TeamInvitationDto {
  id: string;
  organizationId: string;
  email: string;
  role: UserRole;
  status: InvitationStatus;
  invitedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  expiresAt: string | Date;
  acceptedAt?: string | Date | null;
  createdAt: string | Date;
}

export interface InviteTeamMemberDto {
  email: string;
  role: UserRole;
}

export interface AcceptInvitationDto {
  token: string;
  firstName?: string;
  lastName?: string;
  password?: string;
}

export interface ChangeRoleDto {
  role: UserRole;
}
