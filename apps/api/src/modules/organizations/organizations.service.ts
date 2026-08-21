import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateOrganizationInput } from '@propertyos/validation';
import { OrganizationDto, normalizeEmail } from '@propertyos/types';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves organization profile and metadata scoped by organizationId
   */
  async getOrganization(organizationId: string): Promise<OrganizationDto> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        _count: {
          select: {
            users: { where: { deletedAt: null } },
            properties: true,
          },
        },
      },
    });

    if (!org || org.deletedAt) {
      throw new NotFoundException('Organization not found or inactive.');
    }

    return {
      id: org.id,
      name: org.name,
      legalName: org.legalName,
      taxIdGst: org.taxIdGst,
      phone: org.phone,
      email: org.email,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      memberCount: org._count.users,
      propertyCount: org._count.properties,
    };
  }

  /**
   * Updates organization profile details with atomic audit logging
   */
  async updateOrganization(
    organizationId: string,
    actorUserId: string,
    input: UpdateOrganizationInput,
    ip?: string,
    userAgent?: string
  ): Promise<OrganizationDto> {
    const existing = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Organization not found.');
    }

    const dataToUpdate: {
      name?: string;
      legalName?: string | null;
      taxIdGst?: string | null;
      phone?: string | null;
      email?: string | null;
    } = {};

    if (input.name !== undefined) dataToUpdate.name = input.name.trim();
    if (input.legalName !== undefined) dataToUpdate.legalName = input.legalName ? input.legalName.trim() : null;
    if (input.taxIdGst !== undefined) dataToUpdate.taxIdGst = input.taxIdGst ? input.taxIdGst.trim().toUpperCase() : null;
    if (input.phone !== undefined) dataToUpdate.phone = input.phone ? input.phone.trim() : null;
    if (input.email !== undefined) dataToUpdate.email = input.email ? normalizeEmail(input.email) : null;

    const [updatedOrg] = await this.prisma.$transaction([
      this.prisma.organization.update({
        where: { id: organizationId },
        data: dataToUpdate,
        include: {
          _count: {
            select: {
              users: { where: { deletedAt: null } },
              properties: true,
            },
          },
        },
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId,
          userId: actorUserId,
          action: 'ORGANIZATION_UPDATED',
          resourceType: 'Organization',
          resourceId: organizationId,
          ipAddress: ip || null,
          userAgent: userAgent || null,
          metadata: {
            changes: Object.keys(dataToUpdate),
          },
        },
      }),
    ]);

    return {
      id: updatedOrg.id,
      name: updatedOrg.name,
      legalName: updatedOrg.legalName,
      taxIdGst: updatedOrg.taxIdGst,
      phone: updatedOrg.phone,
      email: updatedOrg.email,
      createdAt: updatedOrg.createdAt,
      updatedAt: updatedOrg.updatedAt,
      memberCount: updatedOrg._count.users,
      propertyCount: updatedOrg._count.properties,
    };
  }
}
