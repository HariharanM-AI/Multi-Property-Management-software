import { UserRole } from './auth';

// ==============================================================================
// PropertyOS Granular Permissions & RBAC Matrix
// ==============================================================================

export enum Permission {
  // Organization Management
  ORGANIZATION_READ = 'organization.read',
  ORGANIZATION_UPDATE = 'organization.update',

  // Team & RBAC Management
  TEAM_READ = 'team.read',
  TEAM_INVITE = 'team.invite',
  TEAM_UPDATE = 'team.update',
  TEAM_REMOVE = 'team.remove',

  // Property Management Foundation
  PROPERTY_READ = 'property.read',
  PROPERTY_CREATE = 'property.create',
  PROPERTY_UPDATE = 'property.update',
  PROPERTY_DELETE = 'property.delete',

  // Tenant Management Foundation
  TENANT_READ = 'tenant.read',
  TENANT_CREATE = 'tenant.create',
  TENANT_UPDATE = 'tenant.update',
  TENANT_DELETE = 'tenant.delete',
  TENANT_KYC_READ = 'tenant.kyc.read',
  TENANT_KYC_UPLOAD = 'tenant.kyc.upload',
  TENANT_KYC_VERIFY = 'tenant.kyc.verify',
  TENANT_KYC_DELETE = 'tenant.kyc.delete',

  // Lease Management
  LEASE_READ = 'lease.read',
  LEASE_CREATE = 'lease.create',
  LEASE_UPDATE = 'lease.update',
  LEASE_TERMINATE = 'lease.terminate',

  // Billing & Finance Foundation
  BILLING_READ = 'billing.read',
  BILLING_CREATE = 'billing.create',
  BILLING_UPDATE = 'billing.update',

  // Maintenance & Operations Foundation
  MAINTENANCE_READ = 'maintenance.read',
  MAINTENANCE_CREATE = 'maintenance.create',
  MAINTENANCE_ASSIGN = 'maintenance.assign',
  MAINTENANCE_UPDATE = 'maintenance.update',

  // Check-In & Onboarding Management
  CHECKIN_READ = 'checkin.read',
  CHECKIN_CREATE = 'checkin.create',
  CHECKIN_CANCEL = 'checkin.cancel',

  // Reporting & Analytics Foundation
  REPORTS_READ = 'reports.read',
}

/**
 * Deterministic, Machine-Readable Role-to-Permission Mapping Matrix
 */
export const ROLE_PERMISSIONS_MAP: Record<UserRole, readonly Permission[]> = {
  [UserRole.OWNER]: [
    Permission.ORGANIZATION_READ,
    Permission.ORGANIZATION_UPDATE,
    Permission.TEAM_READ,
    Permission.TEAM_INVITE,
    Permission.TEAM_UPDATE,
    Permission.TEAM_REMOVE,
    Permission.PROPERTY_READ,
    Permission.PROPERTY_CREATE,
    Permission.PROPERTY_UPDATE,
    Permission.PROPERTY_DELETE,
    Permission.TENANT_READ,
    Permission.TENANT_CREATE,
    Permission.TENANT_UPDATE,
    Permission.TENANT_DELETE,
    Permission.TENANT_KYC_READ,
    Permission.TENANT_KYC_UPLOAD,
    Permission.TENANT_KYC_VERIFY,
    Permission.TENANT_KYC_DELETE,
    Permission.LEASE_READ,
    Permission.LEASE_CREATE,
    Permission.LEASE_UPDATE,
    Permission.LEASE_TERMINATE,
    Permission.CHECKIN_READ,
    Permission.CHECKIN_CREATE,
    Permission.CHECKIN_CANCEL,
    Permission.BILLING_READ,
    Permission.BILLING_CREATE,
    Permission.BILLING_UPDATE,
    Permission.MAINTENANCE_READ,
    Permission.MAINTENANCE_CREATE,
    Permission.MAINTENANCE_ASSIGN,
    Permission.MAINTENANCE_UPDATE,
    Permission.REPORTS_READ,
  ],

  [UserRole.PROPERTY_MANAGER]: [
    Permission.ORGANIZATION_READ,
    Permission.TEAM_READ,
    Permission.PROPERTY_READ,
    Permission.PROPERTY_CREATE,
    Permission.PROPERTY_UPDATE,
    Permission.TENANT_READ,
    Permission.TENANT_CREATE,
    Permission.TENANT_UPDATE,
    Permission.TENANT_KYC_READ,
    Permission.TENANT_KYC_UPLOAD,
    Permission.TENANT_KYC_VERIFY,
    Permission.LEASE_READ,
    Permission.LEASE_CREATE,
    Permission.LEASE_UPDATE,
    Permission.LEASE_TERMINATE,
    Permission.CHECKIN_READ,
    Permission.CHECKIN_CREATE,
    Permission.CHECKIN_CANCEL,
    Permission.MAINTENANCE_READ,
    Permission.MAINTENANCE_CREATE,
    Permission.MAINTENANCE_ASSIGN,
    Permission.MAINTENANCE_UPDATE,
    Permission.REPORTS_READ,
  ],

  [UserRole.ACCOUNTANT]: [
    Permission.ORGANIZATION_READ,
    Permission.TEAM_READ,
    Permission.PROPERTY_READ,
    Permission.TENANT_READ,
    Permission.TENANT_KYC_READ,
    Permission.LEASE_READ,
    Permission.CHECKIN_READ,
    Permission.BILLING_READ,
    Permission.BILLING_CREATE,
    Permission.BILLING_UPDATE,
    Permission.REPORTS_READ,
  ],

  [UserRole.WARDEN]: [
    Permission.ORGANIZATION_READ,
    Permission.TEAM_READ,
    Permission.PROPERTY_READ,
    Permission.TENANT_READ,
    Permission.TENANT_UPDATE,
    Permission.TENANT_KYC_READ,
    Permission.TENANT_KYC_UPLOAD,
    Permission.LEASE_READ,
    Permission.LEASE_UPDATE,
    Permission.CHECKIN_READ,
    Permission.CHECKIN_CREATE,
    Permission.MAINTENANCE_READ,
    Permission.MAINTENANCE_CREATE,
    Permission.MAINTENANCE_UPDATE,
  ],

  [UserRole.SECURITY]: [
    Permission.ORGANIZATION_READ,
    Permission.PROPERTY_READ,
    Permission.TENANT_READ,
    Permission.LEASE_READ,
    Permission.CHECKIN_READ,
  ],

  [UserRole.MAINTENANCE_STAFF]: [
    Permission.ORGANIZATION_READ,
    Permission.PROPERTY_READ,
    Permission.MAINTENANCE_READ,
    Permission.MAINTENANCE_UPDATE,
  ],

  [UserRole.TENANT]: [
    Permission.PROPERTY_READ,
    Permission.LEASE_READ,
    Permission.BILLING_READ,
    Permission.MAINTENANCE_READ,
    Permission.MAINTENANCE_CREATE,
  ],
};

/**
 * Checks whether a set of roles satisfies a required permission
 */
export function hasPermission(roles: UserRole[], requiredPermission: Permission): boolean {
  if (!roles || roles.length === 0) return false;
  if (roles.includes(UserRole.OWNER)) return true; // Owner has implicit superuser privileges

  return roles.some((role) => {
    const rolePerms = ROLE_PERMISSIONS_MAP[role];
    return rolePerms ? rolePerms.includes(requiredPermission) : false;
  });
}

/**
 * Checks whether a set of roles satisfies all required permissions
 */
export function hasAllPermissions(roles: UserRole[], requiredPermissions: Permission[]): boolean {
  if (!requiredPermissions || requiredPermissions.length === 0) return true;
  return requiredPermissions.every((perm) => hasPermission(roles, perm));
}

/**
 * Checks whether a set of roles satisfies at least one required permission
 */
export function hasAnyPermission(roles: UserRole[], requiredPermissions: Permission[]): boolean {
  if (!requiredPermissions || requiredPermissions.length === 0) return true;
  return requiredPermissions.some((perm) => hasPermission(roles, perm));
}

/**
 * Standardized Email Normalization Helper (trim whitespace and convert to lowercase)
 */
export function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}
