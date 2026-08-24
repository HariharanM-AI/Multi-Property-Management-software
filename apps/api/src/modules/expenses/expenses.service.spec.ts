import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesService } from './expenses.service';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('ExpensesService (CORE-020 Unit Tests)', () => {
  let service: ExpensesService;
  let prisma: any;
  let storage: any;

  const mockOrgId = 'org-uuid-1111';
  const mockUserId = 'user-uuid-2222';
  const mockPropertyId = 'prop-uuid-3333';
  const mockCategoryId = 'cat-uuid-4444';
  const mockExpenseId = 'exp-uuid-5555';

  const mockProperty = {
    id: mockPropertyId,
    organizationId: mockOrgId,
    name: 'Green View Residency',
    type: 'PG',
  };

  const mockCategory = {
    id: mockCategoryId,
    name: 'MAINTENANCE',
    description: 'Operational maintenance expense category',
  };

  const mockExpenseRecord = {
    id: mockExpenseId,
    organizationId: mockOrgId,
    propertyId: mockPropertyId,
    categoryId: mockCategoryId,
    title: 'Plumbing Repair - 2nd Floor',
    amount: new Prisma.Decimal(2500.0),
    expenseDate: new Date('2026-08-15T10:00:00Z'),
    vendorName: 'Apex Plumbing Services',
    receiptUrl: 'https://storage.propertyos.local/receipts/rec-1.pdf',
    notes: 'Fixed bathroom pipe leakage',
    createdAt: new Date('2026-08-15T10:05:00Z'),
    updatedAt: new Date('2026-08-15T10:05:00Z'),
    property: mockProperty,
    category: mockCategory,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      expenseCategory: {
        upsert: jest.fn().mockResolvedValue(mockCategory),
        findMany: jest.fn().mockResolvedValue([mockCategory]),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === mockCategoryId || where.name === 'MAINTENANCE') {
            return Promise.resolve(mockCategory);
          }
          return Promise.resolve(null);
        }),
        create: jest.fn().mockResolvedValue(mockCategory),
      },
      property: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.id === mockPropertyId && where.organizationId === mockOrgId) {
            return Promise.resolve(mockProperty);
          }
          return Promise.resolve(null);
        }),
      },
      expenseRecord: {
        create: jest.fn().mockResolvedValue(mockExpenseRecord),
        findMany: jest.fn().mockResolvedValue([mockExpenseRecord]),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.id === mockExpenseId && where.organizationId === mockOrgId) {
            return Promise.resolve(mockExpenseRecord);
          }
          return Promise.resolve(null);
        }),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue(mockExpenseRecord),
        delete: jest.fn().mockResolvedValue(mockExpenseRecord),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-uuid-9999' }),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => {
        return cb({
          ...mockPrismaService,
          $executeRaw: jest.fn().mockResolvedValue(1),
        });
      }),
    };

    const mockStorageService = {
      validateFile: jest.fn(),
      uploadFile: jest.fn().mockResolvedValue({
        fileUrl: 'https://storage.propertyos.local/expense_receipts/rec-999.pdf',
        storagePath: '/storage/org-1/prop-1/expense_receipts/rec-999.pdf',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
    prisma = module.get(PrismaService);
    storage = module.get(StorageService);
  });

  describe('1. Category Management', () => {
    it('should seed default categories idempotently', async () => {
      await service.ensureDefaultCategories();
      expect(prisma.expenseCategory.upsert).toHaveBeenCalledTimes(10);
    });

    it('should return all categories formatted as DTOs', async () => {
      const categories = await service.getCategories();
      expect(categories).toHaveLength(1);
      expect(categories[0].name).toBe('MAINTENANCE');
    });
  });

  describe('2. Expense Creation', () => {
    it('should create an expense with categoryId successfully', async () => {
      const result = await service.createExpense(
        mockOrgId,
        {
          propertyId: mockPropertyId,
          categoryId: mockCategoryId,
          title: 'Plumbing Repair - 2nd Floor',
          amount: 2500,
          expenseDate: '2026-08-15T10:00:00Z',
          vendorName: 'Apex Plumbing Services',
          receiptUrl: 'https://storage.propertyos.local/receipts/rec-1.pdf',
          notes: 'Fixed bathroom pipe leakage',
        },
        mockUserId
      );

      expect(result.id).toBe(mockExpenseId);
      expect(result.amount).toBe(2500);
      expect(result.categoryName).toBe('MAINTENANCE');
    });

    it('should create an expense with categoryName successfully', async () => {
      const result = await service.createExpense(
        mockOrgId,
        {
          propertyId: mockPropertyId,
          categoryName: 'MAINTENANCE',
          title: 'Plumbing Repair - 2nd Floor',
          amount: 2500,
          expenseDate: '2026-08-15T10:00:00Z',
        },
        mockUserId
      );

      expect(result.categoryName).toBe('MAINTENANCE');
    });

    it('should reject non-existent property with NotFoundException', async () => {
      await expect(
        service.createExpense(
          mockOrgId,
          {
            propertyId: 'non-existent-prop',
            categoryId: mockCategoryId,
            title: 'Electric Bill',
            amount: 1200,
            expenseDate: '2026-08-15T10:00:00Z',
          },
          mockUserId
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject property from foreign organization with NotFoundException', async () => {
      await expect(
        service.createExpense(
          'foreign-org-id',
          {
            propertyId: mockPropertyId,
            categoryId: mockCategoryId,
            title: 'Electric Bill',
            amount: 1200,
            expenseDate: '2026-08-15T10:00:00Z',
          },
          mockUserId
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject zero amount with BadRequestException', async () => {
      await expect(
        service.createExpense(
          mockOrgId,
          {
            propertyId: mockPropertyId,
            categoryId: mockCategoryId,
            title: 'Free Service',
            amount: 0,
            expenseDate: '2026-08-15T10:00:00Z',
          },
          mockUserId
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject negative amount with BadRequestException', async () => {
      await expect(
        service.createExpense(
          mockOrgId,
          {
            propertyId: mockPropertyId,
            categoryId: mockCategoryId,
            title: 'Invalid Expense',
            amount: -500,
            expenseDate: '2026-08-15T10:00:00Z',
          },
          mockUserId
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid category ID with BadRequestException', async () => {
      await expect(
        service.createExpense(
          mockOrgId,
          {
            propertyId: mockPropertyId,
            categoryId: 'invalid-cat-uuid',
            title: 'Painting',
            amount: 5000,
            expenseDate: '2026-08-15T10:00:00Z',
          },
          mockUserId
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. Expense Listing & Filtering', () => {
    it('should list expenses with pagination metadata', async () => {
      const result = await service.getExpenses(mockOrgId, { page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter expenses by propertyId', async () => {
      await service.getExpenses(mockOrgId, { propertyId: mockPropertyId });
      expect(prisma.expenseRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ propertyId: mockPropertyId }),
        })
      );
    });

    it('should filter expenses by categoryId', async () => {
      await service.getExpenses(mockOrgId, { categoryId: mockCategoryId });
      expect(prisma.expenseRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ categoryId: mockCategoryId }),
        })
      );
    });

    it('should filter expenses by date range', async () => {
      await service.getExpenses(mockOrgId, {
        startDate: '2026-08-01T00:00:00Z',
        endDate: '2026-08-31T23:59:59Z',
      });
      expect(prisma.expenseRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            expenseDate: {
              gte: new Date('2026-08-01T00:00:00Z'),
              lte: new Date('2026-08-31T23:59:59Z'),
            },
          }),
        })
      );
    });

    it('should filter expenses by search keyword', async () => {
      await service.getExpenses(mockOrgId, { search: 'Plumbing' });
      expect(prisma.expenseRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { title: { contains: 'Plumbing', mode: 'insensitive' } },
              { vendorName: { contains: 'Plumbing', mode: 'insensitive' } },
              { notes: { contains: 'Plumbing', mode: 'insensitive' } },
            ],
          }),
        })
      );
    });

    it('should filter expenses by min and max amount', async () => {
      await service.getExpenses(mockOrgId, { minAmount: 1000, maxAmount: 5000 });
      expect(prisma.expenseRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            amount: {
              gte: new Prisma.Decimal(1000),
              lte: new Prisma.Decimal(5000),
            },
          }),
        })
      );
    });
  });

  describe('4. Expense Lookup by ID', () => {
    it('should return expense DTO when found in caller organization', async () => {
      const result = await service.getExpenseById(mockOrgId, mockExpenseId);
      expect(result.id).toBe(mockExpenseId);
      expect(result.title).toBe('Plumbing Repair - 2nd Floor');
    });

    it('should reject foreign organization lookup with NotFoundException', async () => {
      await expect(service.getExpenseById('foreign-org', mockExpenseId)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should reject non-existent expense ID with NotFoundException', async () => {
      await expect(service.getExpenseById(mockOrgId, 'non-existent-id')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('5. Expense Updates & Deletion', () => {
    it('should update expense title, amount, and vendor successfully', async () => {
      const result = await service.updateExpense(
        mockOrgId,
        mockExpenseId,
        {
          title: 'Updated Plumbing Repair',
          amount: 3000,
          vendorName: 'Apex Plumbing Solutions Ltd',
        },
        mockUserId
      );

      expect(result).toBeDefined();
    });

    it('should reject foreign expense update with NotFoundException', async () => {
      await expect(
        service.updateExpense(
          'foreign-org',
          mockExpenseId,
          { title: 'Hacked Title' },
          mockUserId
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject negative amount update with BadRequestException', async () => {
      await expect(
        service.updateExpense(
          mockOrgId,
          mockExpenseId,
          { amount: -200 },
          mockUserId
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should delete expense and write audit snapshot', async () => {
      const result = await service.deleteExpense(mockOrgId, mockExpenseId, mockUserId);
      expect(result.success).toBe(true);
      expect(result.message).toContain('deleted successfully');
    });

    it('should reject foreign expense deletion with NotFoundException', async () => {
      await expect(service.deleteExpense('foreign-org', mockExpenseId, mockUserId)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('6. Expense Summary & KPIs', () => {
    it('should calculate summary totals and category breakdown accurately', async () => {
      const summary = await service.getSummary(mockOrgId);
      expect(summary.totalExpenseAmount).toBe('2500');
      expect(summary.totalExpenseCount).toBe(1);
      expect(summary.categoryBreakdown).toHaveLength(1);
      expect(summary.categoryBreakdown[0].category).toBe('MAINTENANCE');
      expect(summary.categoryBreakdown[0].totalAmount).toBe('2500');
    });
  });

  describe('7. Receipt Upload', () => {
    it('should validate file and upload receipt via StorageService', async () => {
      const mockFile = {
        originalname: 'invoice.pdf',
        mimetype: 'application/pdf',
        size: 1024 * 50,
        buffer: Buffer.from('mock content'),
      };

      const result = await service.uploadReceipt(mockOrgId, mockPropertyId, mockFile, mockUserId);
      expect(result.fileUrl).toContain('rec-999.pdf');
      expect(storage.validateFile).toHaveBeenCalledWith(mockFile);
      expect(storage.uploadFile).toHaveBeenCalledWith(
        mockFile,
        mockOrgId,
        mockPropertyId,
        'expense_receipts'
      );
    });

    it('should reject receipt upload on foreign property with NotFoundException', async () => {
      const mockFile = {
        originalname: 'invoice.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('mock content'),
      };

      await expect(
        service.uploadReceipt('foreign-org', mockPropertyId, mockFile, mockUserId)
      ).rejects.toThrow(NotFoundException);
    });
  });
});
