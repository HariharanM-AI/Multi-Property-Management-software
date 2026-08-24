export type VisitorStatus = 'PENDING' | 'APPROVED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'REJECTED';

export interface VisitorRecordDto {
  id: string;
  propertyId: string;
  propertyName?: string;
  tenantId: string;
  tenantName?: string;
  tenantPhone?: string;
  roomOrUnitNumber?: string;
  visitorName: string;
  visitorPhone: string;
  purpose: string;
  gatePassCode: string;
  entryTime: string;
  exitTime?: string | null;
  isApproved: boolean;
  status: VisitorStatus;
  createdAt: string;
}

export interface CreateVisitorDto {
  propertyId: string;
  tenantId: string;
  visitorName: string;
  visitorPhone: string;
  purpose: string;
  entryTime?: string;
  isApproved?: boolean;
}

export interface UpdateVisitorDto {
  visitorName?: string;
  visitorPhone?: string;
  purpose?: string;
  isApproved?: boolean;
}

export interface CheckInVisitorDto {
  entryTime?: string;
  notes?: string;
}

export interface CheckOutVisitorDto {
  exitTime?: string;
  notes?: string;
}

export interface VisitorSummaryDto {
  totalVisitorsToday: number;
  activeVisitorsInside: number;
  expectedVisitors: number;
  totalVisitorsThisMonth: number;
}

export interface VisitorFilterQuery {
  propertyId?: string;
  tenantId?: string;
  status?: VisitorStatus;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}
