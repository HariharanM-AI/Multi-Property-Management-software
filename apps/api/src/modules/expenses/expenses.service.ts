import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import {
  ExpenseCategoryType,
  ExpenseCategoryDto,
  ExpenseRecordDto,
  ExpenseSummaryDto,
  CategoryExpenseBreakdownDto,
} from '@propertyos/types';
import {
  CreateExpenseInput,
  UpdateExpenseInput,
  ExpenseFilterInput,
} from '@propertyos/validation';
import { Prisma } from '@prisma/client';

const DEFAULT_CATEGORIES: ExpenseCategoryType[] = [
  ExpenseCategoryType.SALARY,
  ExpenseCategoryType.ELECTRICITY,
  ExpenseCategoryType.WATER,
  ExpenseCategoryType.FOOD,
  ExpenseCategoryType.MAINTENANCE,
  ExpenseCategoryType.CLEANING,
  ExpenseCategoryType.INTERNET,
  ExpenseCategoryType.SUPPLIES,
  ExpenseCategoryType.PROPERTY_TAX,
  ExpenseCategoryType.OTHER,
];

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService
  ) {}

  /**
   * Ensures all standard expense categories exist in the database idempotently.
   */
  async ensureDefaultCategories(): Promise<void> {
    for (const catName of DEFAULT_CATEGORIES) {
      await this.prisma.expenseCategory.upsert({
        where: { name: catName },
        create: {
          name: catName,
          description: `Operational ${catName.toLowerCase().replace('_', ' ')} expense category`,
        },
        update: {},
      });
    }
  }

  /**
   * Retrieves all available expense categories.
   */
  async getCategories(): Promise<ExpenseCategoryDto[]> {
    await this.ensureDefaultCategories();
    const categories = await this.prisma.expenseCategory.findMany({
      orderBy: { name: 'asc' },
    });

    return categories.map((c) => ({
      id: c.id,
      name: c.name as ExpenseCategoryType,
      description: c.description,
    }));
  }

  /**
   * Creates a new property expense record with transactional audit logging.
   */
  async createExpense(
    organizationId: string,
    input: CreateExpenseInput,
    actorId: string
  ): Promise<ExpenseRecordDto> {
    // 1. Verify property belongs to organization
    const property = await this.prisma.property.findFirst({
      where: { id: input.propertyId, organizationId },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID ${input.propertyId} not found in this organization`);
    }

    // 2. Validate positive amount
    if (input.amount <= 0) {
      throw new BadRequestException('Expense amount must be strictly greater than zero');
    }

    // 3. Resolve Category
    await this.ensureDefaultCategories();
    let category = null;

    if (input.categoryId) {
      category = await this.prisma.expenseCategory.findUnique({
        where: { id: input.categoryId },
      });
      if (!category) {
        throw new BadRequestException(`Category with ID ${input.categoryId} does not exist`);
      }
    } else if (input.categoryName) {
      category = await this.prisma.expenseCategory.findUnique({
        where: { name: input.categoryName as any },
      });
      if (!category) {
        category = await this.prisma.expenseCategory.create({
          data: {
            name: input.categoryName as any,
            description: `Operational ${input.categoryName.toLowerCase().replace('_', ' ')} expense category`,
          },
        });
      }
    }

    if (!category) {
      throw new BadRequestException('Valid categoryId or categoryName must be provided');
    }

    const expenseAmount = new Prisma.Decimal(input.amount);
    const expenseDate = new Date(input.expenseDate);

    // 4. Transactional creation + Audit Log
    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.expenseRecord.create({
        data: {
          organizationId,
          propertyId: input.propertyId,
          categoryId: category.id,
          title: input.title.trim(),
          amount: expenseAmount,
          expenseDate,
          vendorName: input.vendorName ? input.vendorName.trim() : null,
          receiptUrl: input.receiptUrl || null,
          notes: input.notes ? input.notes.trim() : null,
        },
        include: {
          property: true,
          category: true,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: actorId,
          action: 'EXPENSE_CREATED',
          resourceType: 'EXPENSE',
          resourceId: created.id,
          metadata: {
            expenseId: created.id,
            propertyId: created.propertyId,
            propertyName: property.name,
            categoryId: created.categoryId,
            categoryName: category.name,
            title: created.title,
            amount: created.amount.toString(),
            expenseDate: created.expenseDate.toISOString(),
            vendorName: created.vendorName,
            receiptUrl: created.receiptUrl,
          },
        },
      });

      return created;
    });

    return this.formatExpenseDto(result);
  }

  /**
   * Retrieves a paginated and filtered list of expense records for the organization.
   */
  async getExpenses(
    organizationId: string,
    query: ExpenseFilterInput
  ): Promise<{ data: ExpenseRecordDto[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const page = query.page && query.page > 0 ? Number(query.page) : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(Number(query.limit), 100) : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseRecordWhereInput = {
      organizationId,
    };

    if (query.propertyId) {
      where.propertyId = query.propertyId;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.categoryName) {
      where.category = {
        name: query.categoryName as any,
      };
    }

    if (query.startDate || query.endDate) {
      where.expenseDate = {};
      if (query.startDate) {
        where.expenseDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.expenseDate.lte = new Date(query.endDate);
      }
    }

    if (query.minAmount !== undefined || query.maxAmount !== undefined) {
      where.amount = {};
      if (query.minAmount !== undefined) {
        where.amount.gte = new Prisma.Decimal(query.minAmount);
      }
      if (query.maxAmount !== undefined) {
        where.amount.lte = new Prisma.Decimal(query.maxAmount);
      }
    }

    if (query.search && query.search.trim().length > 0) {
      const search = query.search.trim();
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { vendorName: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.expenseRecord.count({ where }),
      this.prisma.expenseRecord.findMany({
        where,
        include: {
          property: true,
          category: true,
        },
        orderBy: { expenseDate: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: records.map((r) => this.formatExpenseDto(r)),
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Retrieves an expense by ID with fail-closed organization scoping.
   */
  async getExpenseById(organizationId: string, id: string): Promise<ExpenseRecordDto> {
    const expense = await this.prisma.expenseRecord.findFirst({
      where: { id, organizationId },
      include: {
        property: true,
        category: true,
      },
    });

    if (!expense) {
      throw new NotFoundException(`Expense record with ID ${id} not found in this organization`);
    }

    return this.formatExpenseDto(expense);
  }

  /**
   * Updates an expense record with advisory locking and audit logging.
   */
  async updateExpense(
    organizationId: string,
    id: string,
    input: UpdateExpenseInput,
    actorId: string
  ): Promise<ExpenseRecordDto> {
    return this.prisma.$transaction(async (tx) => {
      // Advisory lock to serialize concurrent mutations on the same expense
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('expense_mutate_' || ${id}::text))`;

      const existing = await tx.expenseRecord.findFirst({
        where: { id, organizationId },
        include: { property: true, category: true },
      });

      if (!existing) {
        throw new NotFoundException(`Expense record with ID ${id} not found in this organization`);
      }

      if (input.propertyId && input.propertyId !== existing.propertyId) {
        const prop = await tx.property.findFirst({
          where: { id: input.propertyId, organizationId },
        });
        if (!prop) {
          throw new NotFoundException(`Target property ${input.propertyId} not found in this organization`);
        }
      }

      let categoryId = existing.categoryId;
      if (input.categoryId) {
        const cat = await tx.expenseCategory.findUnique({
          where: { id: input.categoryId },
        });
        if (!cat) {
          throw new BadRequestException(`Category with ID ${input.categoryId} does not exist`);
        }
        categoryId = cat.id;
      } else if (input.categoryName) {
        const cat = await tx.expenseCategory.findUnique({
          where: { name: input.categoryName as any },
        });
        if (!cat) {
          const createdCat = await tx.expenseCategory.create({
            data: {
              name: input.categoryName as any,
              description: `Operational ${input.categoryName.toLowerCase().replace('_', ' ')} expense category`,
            },
          });
          categoryId = createdCat.id;
        } else {
          categoryId = cat.id;
        }
      }

      if (input.amount !== undefined && input.amount <= 0) {
        throw new BadRequestException('Expense amount must be strictly greater than zero');
      }

      const updateData: Prisma.ExpenseRecordUpdateInput = {};
      if (input.title !== undefined) updateData.title = input.title.trim();
      if (input.propertyId !== undefined) updateData.property = { connect: { id: input.propertyId } };
      if (categoryId !== existing.categoryId) updateData.category = { connect: { id: categoryId } };
      if (input.amount !== undefined) updateData.amount = new Prisma.Decimal(input.amount);
      if (input.expenseDate !== undefined) updateData.expenseDate = new Date(input.expenseDate);
      if (input.vendorName !== undefined) updateData.vendorName = input.vendorName ? input.vendorName.trim() : null;
      if (input.receiptUrl !== undefined) updateData.receiptUrl = input.receiptUrl;
      if (input.notes !== undefined) updateData.notes = input.notes ? input.notes.trim() : null;

      const updated = await tx.expenseRecord.update({
        where: { id },
        data: updateData,
        include: {
          property: true,
          category: true,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: actorId,
          action: 'EXPENSE_UPDATED',
          resourceType: 'EXPENSE',
          resourceId: id,
          metadata: {
            expenseId: id,
            previous: {
              title: existing.title,
              amount: existing.amount.toString(),
              category: existing.category.name,
              propertyId: existing.propertyId,
              vendorName: existing.vendorName,
            },
            current: {
              title: updated.title,
              amount: updated.amount.toString(),
              category: updated.category.name,
              propertyId: updated.propertyId,
              vendorName: updated.vendorName,
            },
          },
        },
      });

      return this.formatExpenseDto(updated);
    });
  }

  /**
   * Deletes an expense record with advisory locking and audit snapshot.
   */
  async deleteExpense(
    organizationId: string,
    id: string,
    actorId: string
  ): Promise<{ success: boolean; message: string }> {
    return this.prisma.$transaction(async (tx) => {
      // Advisory lock
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('expense_mutate_' || ${id}::text))`;

      const existing = await tx.expenseRecord.findFirst({
        where: { id, organizationId },
        include: { property: true, category: true },
      });

      if (!existing) {
        throw new NotFoundException(`Expense record with ID ${id} not found in this organization`);
      }

      await tx.expenseRecord.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: actorId,
          action: 'EXPENSE_DELETED',
          resourceType: 'EXPENSE',
          resourceId: id,
          metadata: {
            expenseId: id,
            deletedSnapshot: {
              title: existing.title,
              amount: existing.amount.toString(),
              category: existing.category.name,
              propertyId: existing.propertyId,
              propertyName: existing.property.name,
              vendorName: existing.vendorName,
              expenseDate: existing.expenseDate.toISOString(),
            },
          },
        },
      });

      return {
        success: true,
        message: 'Expense record deleted successfully',
      };
    });
  }

  /**
   * Computes expense KPIs and category breakdowns using high-precision Decimal summation.
   */
  async getSummary(
    organizationId: string,
    propertyId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<ExpenseSummaryDto> {
    const where: Prisma.ExpenseRecordWhereInput = {
      organizationId,
    };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) {
        where.expenseDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.expenseDate.lte = new Date(endDate);
      }
    }

    const records = await this.prisma.expenseRecord.findMany({
      where,
      include: { category: true },
    });

    let totalAmount = new Prisma.Decimal(0);
    let currentMonthAmount = new Prisma.Decimal(0);

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const categoryMap = new Map<ExpenseCategoryType, { total: Prisma.Decimal; count: number }>();

    for (const rec of records) {
      totalAmount = totalAmount.plus(rec.amount);

      if (rec.expenseDate >= currentMonthStart && rec.expenseDate <= currentMonthEnd) {
        currentMonthAmount = currentMonthAmount.plus(rec.amount);
      }

      const catName = rec.category.name as ExpenseCategoryType;
      const current = categoryMap.get(catName) || { total: new Prisma.Decimal(0), count: 0 };
      categoryMap.set(catName, {
        total: current.total.plus(rec.amount),
        count: current.count + 1,
      });
    }

    const categoryBreakdown: CategoryExpenseBreakdownDto[] = Array.from(categoryMap.entries()).map(
      ([category, data]) => ({
        category,
        totalAmount: data.total.toString(),
        count: data.count,
      })
    );

    categoryBreakdown.sort((a, b) => Number(b.totalAmount) - Number(a.totalAmount));

    return {
      totalExpenseAmount: totalAmount.toString(),
      currentMonthExpenseAmount: currentMonthAmount.toString(),
      totalExpenseCount: records.length,
      categoryBreakdown,
    };
  }

  /**
   * Handles secure receipt upload via StorageService.
   */
  async uploadReceipt(
    organizationId: string,
    propertyId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    actorId: string
  ): Promise<{ fileUrl: string; fileName: string }> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId },
    });

    if (!property) {
      throw new NotFoundException(`Property ${propertyId} not found in this organization`);
    }

    this.storageService.validateFile(file);

    const uploadResult = await this.storageService.uploadFile(
      file,
      organizationId,
      propertyId,
      'expense_receipts'
    );

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId: actorId,
        action: 'EXPENSE_RECEIPT_UPLOADED',
        resourceType: 'EXPENSE_RECEIPT',
        resourceId: propertyId,
        metadata: {
          propertyId,
          propertyName: property.name,
          fileName: uploadResult.fileName,
          fileUrl: uploadResult.fileUrl,
          fileSize: uploadResult.fileSize,
          mimeType: uploadResult.mimeType,
        },
      },
    });

    return {
      fileUrl: uploadResult.fileUrl,
      fileName: uploadResult.fileName,
    };
  }

  private formatExpenseDto(record: any): ExpenseRecordDto {
    return {
      id: record.id,
      organizationId: record.organizationId,
      propertyId: record.propertyId,
      propertyName: record.property?.name,
      propertyType: record.property?.type,
      categoryId: record.categoryId,
      categoryName: record.category?.name as ExpenseCategoryType,
      title: record.title,
      amount: Number(record.amount),
      expenseDate: record.expenseDate.toISOString(),
      vendorName: record.vendorName,
      receiptUrl: record.receiptUrl,
      notes: record.notes,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
