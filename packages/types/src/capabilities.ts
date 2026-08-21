import { PropertyType } from './index';

export enum PropertyCapability {
  // PG / Co-Living specific capabilities
  FLOORS = 'floors',
  ROOMS = 'rooms',
  BEDS = 'beds',
  MEAL_PLANS = 'mealPlans',
  SHARED_UTILITIES = 'sharedUtilities',
  OCCUPANCY_TRACKING = 'occupancy',

  // Whole-Unit Rental specific capabilities
  RENTAL_UNITS = 'rentalUnits',
  LEASES = 'leases',
  SECURITY_DEPOSITS = 'deposits',
  RENT_ESCALATION = 'rentEscalation',
  NOTICE_PERIODS = 'noticePeriods',

  // Common cross-cutting capabilities
  METERS_ELECTRICITY = 'metersElectricity',
  MAINTENANCE_TICKETS = 'maintenanceTickets',
  EXPENSE_TRACKING = 'expenseTracking',
  REPORTS = 'reports',
}

export const PROPERTY_CAPABILITIES_CONFIG: Record<PropertyType, readonly PropertyCapability[]> = {
  [PropertyType.PG]: [
    PropertyCapability.FLOORS,
    PropertyCapability.ROOMS,
    PropertyCapability.BEDS,
    PropertyCapability.MEAL_PLANS,
    PropertyCapability.SHARED_UTILITIES,
    PropertyCapability.OCCUPANCY_TRACKING,
    PropertyCapability.METERS_ELECTRICITY,
    PropertyCapability.MAINTENANCE_TICKETS,
    PropertyCapability.EXPENSE_TRACKING,
    PropertyCapability.REPORTS,
  ],
  [PropertyType.RENTAL_HOUSE]: [
    PropertyCapability.RENTAL_UNITS,
    PropertyCapability.LEASES,
    PropertyCapability.SECURITY_DEPOSITS,
    PropertyCapability.RENT_ESCALATION,
    PropertyCapability.NOTICE_PERIODS,
    PropertyCapability.METERS_ELECTRICITY,
    PropertyCapability.MAINTENANCE_TICKETS,
    PropertyCapability.EXPENSE_TRACKING,
    PropertyCapability.REPORTS,
  ],
};

export function hasPropertyCapability(type: PropertyType, capability: PropertyCapability): boolean {
  const capabilities = PROPERTY_CAPABILITIES_CONFIG[type];
  return capabilities ? capabilities.includes(capability) : false;
}

export function getPropertyCapabilities(type: PropertyType): readonly PropertyCapability[] {
  return PROPERTY_CAPABILITIES_CONFIG[type] || [];
}
