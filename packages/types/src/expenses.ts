// ==============================================================================
// PropertyOS — Expense Management Types & DTOs (CORE-020)
// ==============================================================================

import { ExpenseCategoryType } from './domain.js';

export interface ExpenseCategoryDto {
  id: string;
  name: ExpenseCategoryType;
  description?: string | null;
}

export interface ExpenseRecordDto {
  id: string;
  organizationId: string;
  propertyId: string;
  propertyName?: string;
  propertyType?: string;
  categoryId: string;
  categoryName: ExpenseCategoryType;
  title: string;
  amount: number;
  expenseDate: string;
  vendorName?: string | null;
  receiptUrl?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryExpenseBreakdownDto {
  category: ExpenseCategoryType;
  totalAmount: string; // Decimal-safe string
  count: number;
}

export interface ExpenseSummaryDto {
  totalExpenseAmount: string; // Decimal-safe string
  currentMonthExpenseAmount: string; // Decimal-safe string
  totalExpenseCount: number;
  categoryBreakdown: CategoryExpenseBreakdownDto[];
}

export interface CreateExpenseDto {
  propertyId: string;
  categoryId?: string;
  categoryName?: ExpenseCategoryType;
  title: string;
  amount: number;
  expenseDate: string;
  vendorName?: string | null;
  receiptUrl?: string | null;
  notes?: string | null;
}

export interface UpdateExpenseDto {
  propertyId?: string;
  categoryId?: string;
  categoryName?: ExpenseCategoryType;
  title?: string;
  amount?: number;
  expenseDate?: string;
  vendorName?: string | null;
  receiptUrl?: string | null;
  notes?: string | null;
}

export interface ExpenseFilterQuery {
  propertyId?: string;
  categoryId?: string;
  categoryName?: ExpenseCategoryType;
  startDate?: string;
  endDate?: string;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  limit?: number;
}
