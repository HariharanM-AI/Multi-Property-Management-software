import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  SecurityDepositAccountDto,
  UpdateSecurityDepositAccountDto,
} from '@propertyos/types';
import { Prisma } from '@prisma/client';

@Injectable()
export class SecurityDepositsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves or initializes a SecurityDepositAccount for a tenant
   */
  async getOrCreateAccount(
    organizationId: string,
    tenantId: string,
    leaseId?: string | null,
    checkInId?: string | null
  ): Promise<SecurityDepositAccountDto> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, organizationId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    let account = await this.prisma.securityDepositAccount.findFirst({
      where: {
        organizationId,
        tenantId,
        leaseId: leaseId || undefined,
      },
      include: { tenant: true },
    });

    if (!account) {
      account = await this.prisma.securityDepositAccount.create({
        data: {
          organizationId,
          tenantId,
          leaseId: leaseId || null,
          checkInId: checkInId || null,
          amountHeld: new Prisma.Decimal(0),
          amountRefunded: new Prisma.Decimal(0),
          amountDeducted: new Prisma.Decimal(0),
        },
        include: { tenant: true },
      });
    }

    return this.mapToDto(account);
  }

  /**
   * Updates a security deposit account and checks non-negative & invariant constraints:
   * amountRefunded + amountDeducted <= amountHeld
   */
  async updateDeposit(
    organizationId: string,
    id: string,
    dto: UpdateSecurityDepositAccountDto,
    userId?: string
  ): Promise<SecurityDepositAccountDto> {
    const existing = await this.prisma.securityDepositAccount.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(`Security deposit account ${id} not found`);
    }

    let amountHeld = existing.amountHeld;
    let amountRefunded = existing.amountRefunded;
    let amountDeducted = existing.amountDeducted;

    if (dto.amountHeld !== undefined) {
      const held = new Prisma.Decimal(dto.amountHeld);
      if (held.isNegative()) {
        throw new BadRequestException('amountHeld cannot be negative');
      }
      amountHeld = held;
    }

    if (dto.deductionAmount !== undefined) {
      const deduction = new Prisma.Decimal(dto.deductionAmount);
      if (deduction.isNegative()) {
        throw new BadRequestException('deductionAmount cannot be negative');
      }
      amountDeducted = amountDeducted.plus(deduction);
    }

    if (dto.refundAmount !== undefined) {
      const refund = new Prisma.Decimal(dto.refundAmount);
      if (refund.isNegative()) {
        throw new BadRequestException('refundAmount cannot be negative');
      }
      amountRefunded = amountRefunded.plus(refund);
    }

    // Invariant check
    const totalOut = amountRefunded.plus(amountDeducted);
    if (totalOut.greaterThan(amountHeld)) {
      throw new BadRequestException(
        `Security deposit invariant violated: sum of refunded (${amountRefunded.toString()}) and deducted (${amountDeducted.toString()}) cannot exceed held deposit (${amountHeld.toString()})`
      );
    }

    const updated = await this.prisma.securityDepositAccount.update({
      where: { id },
      data: {
        amountHeld,
        amountRefunded,
        amountDeducted,
      },
      include: { tenant: true },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId: userId || null,
        action: 'SECURITY_DEPOSIT_UPDATED',
        resourceType: 'SecurityDepositAccount',
        resourceId: id,
        metadata: {
          amountHeld: amountHeld.toString(),
          amountRefunded: amountRefunded.toString(),
          amountDeducted: amountDeducted.toString(),
          reason: dto.reason,
        },
      },
    });

    return this.mapToDto(updated);
  }

  /**
   * Retrieves security deposit account by ID
   */
  async getSecurityDeposit(
    organizationId: string,
    id: string
  ): Promise<SecurityDepositAccountDto> {
    const account = await this.prisma.securityDepositAccount.findFirst({
      where: { id, organizationId },
      include: { tenant: true },
    });

    if (!account) {
      throw new NotFoundException(`Security deposit account ${id} not found`);
    }

    return this.mapToDto(account);
  }

  /**
   * Retrieves security deposit by tenantId
   */
  async getTenantDeposit(
    organizationId: string,
    tenantId: string
  ): Promise<SecurityDepositAccountDto> {
    return this.getOrCreateAccount(organizationId, tenantId);
  }

  /**
   * Lists security deposit accounts for an organization
   */
  async listSecurityDeposits(
    organizationId: string,
    query?: { tenantId?: string }
  ): Promise<SecurityDepositAccountDto[]> {
    const where: Prisma.SecurityDepositAccountWhereInput = {
      organizationId,
    };

    if (query?.tenantId) {
      where.tenantId = query.tenantId;
    }

    const accounts = await this.prisma.securityDepositAccount.findMany({
      where,
      include: { tenant: true },
      orderBy: { updatedAt: 'desc' },
    });

    return accounts.map(this.mapToDto);
  }

  private mapToDto(account: any): SecurityDepositAccountDto {
    const held = new Prisma.Decimal(account.amountHeld);
    const refunded = new Prisma.Decimal(account.amountRefunded);
    const deducted = new Prisma.Decimal(account.amountDeducted);
    const available = held.minus(refunded).minus(deducted);

    return {
      id: account.id,
      organizationId: account.organizationId,
      tenantId: account.tenantId,
      leaseId: account.leaseId,
      checkInId: account.checkInId,
      amountHeld: held.toString(),
      amountRefunded: refunded.toString(),
      amountDeducted: deducted.toString(),
      availableBalance: available.toString(),
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
      tenant: account.tenant
        ? {
            id: account.tenant.id,
            firstName: account.tenant.firstName,
            lastName: account.tenant.lastName,
            phone: account.tenant.phone,
          }
        : undefined,
    };
  }
}
