import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SettlementStatus } from '@propertyos/types';

export interface CalculatedSettlementResult {
  securityDeposit: Prisma.Decimal;
  outstandingRent: Prisma.Decimal;
  maintenanceCharges: Prisma.Decimal;
  deductions: Prisma.Decimal;
  refundableAmount: Prisma.Decimal;
  amountDue: Prisma.Decimal;
  amountRefundable: Prisma.Decimal;
}

@Injectable()
export class SettlementService {
  /**
   * Deterministic, Decimal-only calculation of tenant settlement
   */
  calculateSettlement(params: {
    securityDeposit: number | Prisma.Decimal | string;
    outstandingRent?: number | Prisma.Decimal | string;
    maintenanceCharges?: number | Prisma.Decimal | string;
    deductions?: number | Prisma.Decimal | string;
  }): CalculatedSettlementResult {
    const toDecimal = (val: number | Prisma.Decimal | string | undefined, fieldName: string): Prisma.Decimal => {
      if (val === undefined || val === null || val === '') {
        return new Prisma.Decimal(0);
      }
      const dec = new Prisma.Decimal(val);
      if (dec.isNegative()) {
        throw new BadRequestException(`${fieldName} cannot be negative`);
      }
      return dec;
    };

    const deposit = toDecimal(params.securityDeposit, 'Security deposit');
    const rent = toDecimal(params.outstandingRent, 'Outstanding rent');
    const maintenance = toDecimal(params.maintenanceCharges, 'Maintenance charges');
    const deductions = toDecimal(params.deductions, 'Deductions');

    // Refundable deposit after damage / maintenance deductions
    // refundableDeposit = max(deposit - deductions, 0)
    let refundableDeposit = deposit.minus(deductions);
    if (refundableDeposit.isNegative()) {
      refundableDeposit = new Prisma.Decimal(0);
    }

    // Total outstanding charges
    const totalCharges = rent.plus(maintenance);

    let amountDue = new Prisma.Decimal(0);
    let amountRefundable = new Prisma.Decimal(0);

    if (totalCharges.greaterThan(refundableDeposit)) {
      amountDue = totalCharges.minus(refundableDeposit);
      amountRefundable = new Prisma.Decimal(0);
    } else {
      amountRefundable = refundableDeposit.minus(totalCharges);
      amountDue = new Prisma.Decimal(0);
    }

    // Mathematical guarantees:
    // 1. Neither amountDue nor amountRefundable is negative
    // 2. amountDue and amountRefundable are mutually exclusive (cannot both be positive)
    if (amountDue.isNegative() || amountRefundable.isNegative()) {
      throw new BadRequestException('Calculation invariant violation: negative settlement amounts');
    }

    if (amountDue.greaterThan(0) && amountRefundable.greaterThan(0)) {
      throw new BadRequestException('Calculation invariant violation: both amountDue and amountRefundable are positive');
    }

    return {
      securityDeposit: deposit,
      outstandingRent: rent,
      maintenanceCharges: maintenance,
      deductions,
      refundableAmount: refundableDeposit,
      amountDue,
      amountRefundable,
    };
  }
}
