import { BadRequestException } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { Prisma } from '@prisma/client';

describe('SettlementService', () => {
  let service: SettlementService;

  beforeEach(() => {
    service = new SettlementService();
  });

  describe('calculateSettlement', () => {
    it('should correctly calculate a standard settlement with refund', () => {
      // Security deposit = 60,000, Deductions = 5,000, Outstanding Rent = 10,000, Maintenance = 0
      // Refundable deposit = 55,000. 55,000 - 10,000 = 45,000 refundable
      const result = service.calculateSettlement({
        securityDeposit: 60000,
        outstandingRent: 10000,
        maintenanceCharges: 0,
        deductions: 5000,
      });

      expect(result.securityDeposit.toNumber()).toBe(60000);
      expect(result.deductions.toNumber()).toBe(5000);
      expect(result.refundableAmount.toNumber()).toBe(55000);
      expect(result.amountRefundable.toNumber()).toBe(45000);
      expect(result.amountDue.toNumber()).toBe(0);
    });

    it('should correctly calculate when outstanding charges exceed deposit (amountDue > 0)', () => {
      // Security deposit = 55,000, Outstanding rent = 70,000
      // Deductions = 0 -> amountDue = 15,000, amountRefundable = 0
      const result = service.calculateSettlement({
        securityDeposit: 55000,
        outstandingRent: 70000,
        maintenanceCharges: 0,
        deductions: 0,
      });

      expect(result.amountDue.toNumber()).toBe(15000);
      expect(result.amountRefundable.toNumber()).toBe(0);
    });

    it('should handle full deposit consumption by deductions and charges', () => {
      const result = service.calculateSettlement({
        securityDeposit: 20000,
        outstandingRent: 10000,
        maintenanceCharges: 5000,
        deductions: 25000, // exceeds deposit
      });

      // refundable deposit is max(20000 - 25000, 0) = 0
      // total charges = 15000 -> amountDue = 15000, amountRefundable = 0
      expect(result.refundableAmount.toNumber()).toBe(0);
      expect(result.amountDue.toNumber()).toBe(15000);
      expect(result.amountRefundable.toNumber()).toBe(0);
    });

    it('should correctly handle zero settlement (all zeros)', () => {
      const result = service.calculateSettlement({
        securityDeposit: 0,
        outstandingRent: 0,
        maintenanceCharges: 0,
        deductions: 0,
      });

      expect(result.refundableAmount.toNumber()).toBe(0);
      expect(result.amountDue.toNumber()).toBe(0);
      expect(result.amountRefundable.toNumber()).toBe(0);
    });

    it('should accept Prisma.Decimal inputs directly', () => {
      const result = service.calculateSettlement({
        securityDeposit: new Prisma.Decimal('50000.50'),
        outstandingRent: new Prisma.Decimal('10000.25'),
        maintenanceCharges: new Prisma.Decimal('2000.00'),
        deductions: new Prisma.Decimal('5000.00'),
      });

      expect(result.refundableAmount.toString()).toBe('45000.5');
      expect(result.amountRefundable.toString()).toBe('33000.25');
      expect(result.amountDue.toNumber()).toBe(0);
    });

    it('should reject negative security deposit', () => {
      expect(() =>
        service.calculateSettlement({
          securityDeposit: -5000,
        })
      ).toThrow(BadRequestException);
    });

    it('should reject negative outstanding rent', () => {
      expect(() =>
        service.calculateSettlement({
          securityDeposit: 10000,
          outstandingRent: -100,
        })
      ).toThrow(BadRequestException);
    });

    it('should reject negative maintenance charges', () => {
      expect(() =>
        service.calculateSettlement({
          securityDeposit: 10000,
          maintenanceCharges: -50,
        })
      ).toThrow(BadRequestException);
    });

    it('should reject negative deductions', () => {
      expect(() =>
        service.calculateSettlement({
          securityDeposit: 10000,
          deductions: -200,
        })
      ).toThrow(BadRequestException);
    });
  });
});
