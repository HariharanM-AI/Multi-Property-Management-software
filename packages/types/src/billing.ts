/**
 * PropertyOS — CORE-011: Billing, Invoicing & Ledger Foundation Types & DTOs
 */

export enum BillingFrequency {
  ONE_TIME = 'ONE_TIME',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

export enum ChargeType {
  RENT = 'RENT',
  SECURITY_DEPOSIT = 'SECURITY_DEPOSIT',
  MAINTENANCE = 'MAINTENANCE',
  UTILITY = 'UTILITY',
  LATE_FEE = 'LATE_FEE',
  DAMAGE = 'DAMAGE',
  OTHER = 'OTHER',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  VOID = 'VOID',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  RECORDED = 'RECORDED',
  ALLOCATED = 'ALLOCATED',
  PARTIALLY_ALLOCATED = 'PARTIALLY_ALLOCATED',
  REFUNDED = 'REFUNDED',
  VOID = 'VOID',
}

export enum PaymentMethod {
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  UPI = 'UPI',
  CARD = 'CARD',
  CHEQUE = 'CHEQUE',
  OTHER = 'OTHER',
}

export enum LedgerEntryType {
  INVOICE = 'INVOICE',
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
  ADJUSTMENT = 'ADJUSTMENT',
  REVERSAL = 'REVERSAL',
  SECURITY_DEPOSIT = 'SECURITY_DEPOSIT',
  SECURITY_DEPOSIT_REFUND = 'SECURITY_DEPOSIT_REFUND',
}

export enum LedgerAccountType {
  TENANT_RECEIVABLE = 'TENANT_RECEIVABLE',
  RENT_REVENUE = 'RENT_REVENUE',
  MAINTENANCE_REVENUE = 'MAINTENANCE_REVENUE',
  UTILITY_REVENUE = 'UTILITY_REVENUE',
  SECURITY_DEPOSIT_LIABILITY = 'SECURITY_DEPOSIT_LIABILITY',
  CASH = 'CASH',
  BANK = 'BANK',
  REFUND_PAYABLE = 'REFUND_PAYABLE',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum PaymentAllocationStatus {
  ACTIVE = 'ACTIVE',
  REVERSED = 'REVERSED',
}

// ------------------------------------------------------------------------------
// DTOs & Interfaces
// ------------------------------------------------------------------------------

export interface BillingChargeDto {
  id: string;
  organizationId: string;
  name: string;
  chargeType: ChargeType;
  description?: string | null;
  amount: string; // Decimal as string
  frequency: BillingFrequency;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBillingChargeDto {
  name: string;
  chargeType: ChargeType;
  description?: string | null;
  amount: string | number;
  frequency: BillingFrequency;
  isActive?: boolean;
}

export interface UpdateBillingChargeDto {
  name?: string;
  description?: string | null;
  amount?: string | number;
  frequency?: BillingFrequency;
  isActive?: boolean;
}

export interface BillingScheduleDto {
  id: string;
  organizationId: string;
  tenantId: string;
  propertyId?: string | null;
  leaseId?: string | null;
  checkInId?: string | null;
  chargeId: string;
  startDate: string;
  endDate?: string | null;
  frequency: BillingFrequency;
  amount: string;
  nextBillingDate?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  charge?: BillingChargeDto;
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone: string;
  };
  property?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface CreateBillingScheduleDto {
  tenantId: string;
  propertyId?: string | null;
  leaseId?: string | null;
  checkInId?: string | null;
  chargeId: string;
  startDate: string;
  endDate?: string | null;
  frequency: BillingFrequency;
  amount?: string | number; // defaults to charge.amount if omitted
  active?: boolean;
}

export interface UpdateBillingScheduleDto {
  endDate?: string | null;
  amount?: string | number;
  frequency?: BillingFrequency;
  nextBillingDate?: string | null;
  active?: boolean;
}

export interface InvoiceLineDto {
  id: string;
  invoiceId: string;
  chargeId?: string | null;
  description: string;
  chargeType: ChargeType;
  quantity: string;
  unitAmount: string;
  totalAmount: string;
  createdAt: string;
}

export interface CreateInvoiceLineDto {
  chargeId?: string | null;
  description: string;
  chargeType: ChargeType;
  quantity?: string | number;
  unitAmount: string | number;
}

export interface InvoiceDto {
  id: string;
  organizationId: string;
  tenantId: string;
  propertyId?: string | null;
  leaseId?: string | null;
  checkInId?: string | null;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  adjustments: string;
  totalAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  status: InvoiceStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  lines?: InvoiceLineDto[];
  allocations?: PaymentAllocationDto[];
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone: string;
  };
  property?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface CreateInvoiceDto {
  tenantId: string;
  propertyId?: string | null;
  leaseId?: string | null;
  checkInId?: string | null;
  issueDate: string;
  dueDate: string;
  lines: CreateInvoiceLineDto[];
  adjustments?: string | number;
  notes?: string | null;
}

export interface UpdateInvoiceDto {
  dueDate?: string;
  adjustments?: string | number;
  notes?: string | null;
  lines?: CreateInvoiceLineDto[];
}

export interface PaymentAllocationDto {
  id: string;
  paymentId: string;
  invoiceId: string;
  amount: string;
  status: PaymentAllocationStatus;
  createdAt: string;
  invoice?: InvoiceDto;
  payment?: PaymentDto;
}

export interface AllocatePaymentDto {
  invoiceId: string;
  amount: string | number;
}

export interface PaymentDto {
  id: string;
  organizationId: string;
  tenantId: string;
  amount: string;
  allocatedAmount?: string;
  unallocatedAmount?: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string | null;
  paymentDate: string;
  status: PaymentStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  allocations?: PaymentAllocationDto[];
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone: string;
  };
}

export interface CreatePaymentDto {
  tenantId: string;
  amount: string | number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string | null;
  paymentDate: string;
  notes?: string | null;
  allocations?: AllocatePaymentDto[];
}

export interface CreditDto {
  id: string;
  organizationId: string;
  tenantId: string;
  amount: string;
  remainingAmount: string;
  reason: string;
  sourceInvoiceId?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCreditDto {
  tenantId: string;
  amount: string | number;
  reason: string;
  sourceInvoiceId?: string | null;
}

export interface SecurityDepositAccountDto {
  id: string;
  organizationId: string;
  tenantId: string;
  leaseId?: string | null;
  checkInId?: string | null;
  amountHeld: string;
  amountRefunded: string;
  amountDeducted: string;
  availableBalance: string;
  createdAt: string;
  updatedAt: string;
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
}

export interface UpdateSecurityDepositAccountDto {
  amountHeld?: string | number;
  deductionAmount?: string | number;
  refundAmount?: string | number;
  reason?: string;
}

export interface LedgerEntryDto {
  id: string;
  organizationId: string;
  tenantId: string;
  invoiceId?: string | null;
  paymentId?: string | null;
  entryType: LedgerEntryType;
  accountType: LedgerAccountType;
  debitAmount: string;
  creditAmount: string;
  reference?: string | null;
  description?: string | null;
  createdAt: string;
}

export interface TenantFinancialSummaryDto {
  tenantId: string;
  totalInvoiced: string;
  totalPaid: string;
  outstandingBalance: string;
  activeCredits: string;
  securityDepositHeld: string;
  securityDepositDeducted: string;
  securityDepositRefunded: string;
  availableDeposit: string;
  currentInvoiceCount: number;
  overdueInvoiceCount: number;
  lastInvoiceDate?: string | null;
  lastPaymentDate?: string | null;
}

export interface PropertyFinancialSummaryDto {
  propertyId: string;
  totalInvoiced: string;
  totalCollected: string;
  outstandingAmount: string;
  overdueAmount: string;
  activeTenantCount: number;
  totalInvoiceCount: number;
  paidInvoiceCount: number;
}

export interface OrganizationFinancialSummaryDto {
  totalRevenueInvoiced: string;
  totalPaymentsCollected: string;
  totalOutstanding: string;
  totalOverdue: string;
  totalRefundsIssued: string;
  totalDepositsHeld: string;
  totalInvoiceCount: number;
  totalPaymentCount: number;
}

export interface InvoiceSummaryDto {
  totalInvoiced: string;
  totalPaid: string;
  totalOutstanding: string;
  count: number;
}
