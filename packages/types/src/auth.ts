// ==============================================================================
// PropertyOS Authentication & RBAC Types
// ==============================================================================

export enum UserRole {
  OWNER = 'OWNER',
  PROPERTY_MANAGER = 'PROPERTY_MANAGER',
  ACCOUNTANT = 'ACCOUNTANT',
  WARDEN = 'WARDEN',
  SECURITY = 'SECURITY',
  MAINTENANCE_STAFF = 'MAINTENANCE_STAFF',
  TENANT = 'TENANT',
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  organizationId: string;
  roles: UserRole[];
  permissions?: string[];
  isActive: boolean;
}

export interface AuthOrganization {
  id: string;
  name: string;
  legalName?: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  organizationId: string;
  organizationName?: string;
  roles: UserRole[];
}

export interface AuthResponseData {
  user: AuthUser;
  organization: AuthOrganization;
  message?: string;
}

export interface SessionData {
  userId: string;
  organizationId: string;
  roles: UserRole[];
  sessionId: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  orgId: string;
  roles: UserRole[];
  sessionId?: string;
  iat?: number;
  exp?: number;
}
