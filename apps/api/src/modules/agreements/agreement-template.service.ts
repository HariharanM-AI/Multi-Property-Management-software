import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  AgreementTemplateDto,
  CreateAgreementTemplateDto,
  UpdateAgreementTemplateDto,
  TemplateStatus,
  AgreementType,
} from '@propertyos/types';

@Injectable()
export class AgreementTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async createTemplate(
    organizationId: string,
    dto: CreateAgreementTemplateDto,
    userId?: string
  ): Promise<AgreementTemplateDto> {
    const template = await this.prisma.agreementTemplate.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        agreementType: dto.agreementType,
        description: dto.description?.trim() || null,
        content: dto.content,
        version: 1,
        status: TemplateStatus.DRAFT,
      },
    });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          action: 'AGREEMENT_TEMPLATE_CREATED',
          resourceType: 'AGREEMENT_TEMPLATE',
          resourceId: template.id,
          metadata: { name: template.name, agreementType: template.agreementType, version: 1 },
        },
      });
    }

    return template as unknown as AgreementTemplateDto;
  }

  async listTemplates(
    organizationId: string,
    query: {
      status?: TemplateStatus;
      agreementType?: AgreementType;
      search?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ templates: AgreementTemplateDto[]; total: number; page: number; limit: number }> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const where: any = { organizationId };
    if (query.status) where.status = query.status;
    if (query.agreementType) where.agreementType = query.agreementType;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [templates, total] = await Promise.all([
      this.prisma.agreementTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ name: 'asc' }, { version: 'desc' }],
      }),
      this.prisma.agreementTemplate.count({ where }),
    ]);

    return {
      templates: templates as unknown as AgreementTemplateDto[],
      total,
      page,
      limit,
    };
  }

  async getTemplate(organizationId: string, templateId: string): Promise<AgreementTemplateDto> {
    const template = await this.prisma.agreementTemplate.findFirst({
      where: { id: templateId, organizationId },
    });

    if (!template) {
      throw new NotFoundException(`Agreement template ${templateId} not found`);
    }

    return template as unknown as AgreementTemplateDto;
  }

  async updateTemplate(
    organizationId: string,
    templateId: string,
    dto: UpdateAgreementTemplateDto,
    userId?: string
  ): Promise<AgreementTemplateDto> {
    const existing = await this.prisma.agreementTemplate.findFirst({
      where: { id: templateId, organizationId },
      include: { _count: { select: { agreements: true } } },
    });

    if (!existing) {
      throw new NotFoundException(`Agreement template ${templateId} not found`);
    }

    if (existing.status === TemplateStatus.ARCHIVED) {
      throw new BadRequestException('Archived templates cannot be edited');
    }

    // If template is DRAFT and has not been used to generate agreements, update in place
    if (existing.status === TemplateStatus.DRAFT && existing._count.agreements === 0) {
      const updated = await this.prisma.agreementTemplate.update({
        where: { id: templateId },
        data: {
          name: dto.name ? dto.name.trim() : existing.name,
          description: dto.description !== undefined ? dto.description : existing.description,
          content: dto.content !== undefined ? dto.content : existing.content,
        },
      });

      if (userId) {
        await this.prisma.auditLog.create({
          data: {
            organizationId,
            userId,
            action: 'AGREEMENT_TEMPLATE_UPDATED',
            resourceType: 'AGREEMENT_TEMPLATE',
            resourceId: updated.id,
            metadata: { version: updated.version, inPlace: true },
          },
        });
      }

      return updated as unknown as AgreementTemplateDto;
    }

    // If template is ACTIVE or has been used in agreements, create a new version to guarantee immutability
    const newVersion = await this.prisma.agreementTemplate.create({
      data: {
        organizationId,
        name: dto.name ? dto.name.trim() : existing.name,
        agreementType: existing.agreementType,
        description: dto.description !== undefined ? dto.description : existing.description,
        content: dto.content !== undefined ? dto.content : existing.content,
        version: existing.version + 1,
        status: TemplateStatus.DRAFT,
      },
    });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          action: 'AGREEMENT_TEMPLATE_UPDATED',
          resourceType: 'AGREEMENT_TEMPLATE',
          resourceId: newVersion.id,
          metadata: {
            previousVersion: existing.version,
            newVersion: newVersion.version,
            previousTemplateId: existing.id,
          },
        },
      });
    }

    return newVersion as unknown as AgreementTemplateDto;
  }

  async activateTemplate(
    organizationId: string,
    templateId: string,
    userId?: string
  ): Promise<AgreementTemplateDto> {
    const existing = await this.prisma.agreementTemplate.findFirst({
      where: { id: templateId, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(`Agreement template ${templateId} not found`);
    }

    if (existing.status === TemplateStatus.ACTIVE) {
      return existing as unknown as AgreementTemplateDto;
    }

    if (existing.status === TemplateStatus.ARCHIVED) {
      throw new BadRequestException('Archived templates cannot be activated directly. Create a new version instead.');
    }

    const updated = await this.prisma.agreementTemplate.update({
      where: { id: templateId },
      data: { status: TemplateStatus.ACTIVE },
    });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          action: 'AGREEMENT_TEMPLATE_ACTIVATED',
          resourceType: 'AGREEMENT_TEMPLATE',
          resourceId: updated.id,
          metadata: { name: updated.name, version: updated.version },
        },
      });
    }

    return updated as unknown as AgreementTemplateDto;
  }

  async archiveTemplate(
    organizationId: string,
    templateId: string,
    userId?: string
  ): Promise<AgreementTemplateDto> {
    const existing = await this.prisma.agreementTemplate.findFirst({
      where: { id: templateId, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(`Agreement template ${templateId} not found`);
    }

    if (existing.status === TemplateStatus.ARCHIVED) {
      return existing as unknown as AgreementTemplateDto;
    }

    const updated = await this.prisma.agreementTemplate.update({
      where: { id: templateId },
      data: { status: TemplateStatus.ARCHIVED },
    });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          action: 'AGREEMENT_TEMPLATE_ARCHIVED',
          resourceType: 'AGREEMENT_TEMPLATE',
          resourceId: updated.id,
          metadata: { name: updated.name, version: updated.version },
        },
      });
    }

    return updated as unknown as AgreementTemplateDto;
  }

  async createNewVersion(
    organizationId: string,
    templateId: string,
    dto?: UpdateAgreementTemplateDto,
    userId?: string
  ): Promise<AgreementTemplateDto> {
    const existing = await this.prisma.agreementTemplate.findFirst({
      where: { id: templateId, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(`Agreement template ${templateId} not found`);
    }

    // Find highest version for this template name and agreement type
    const highest = await this.prisma.agreementTemplate.findFirst({
      where: { organizationId, name: existing.name, agreementType: existing.agreementType },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (highest?.version || existing.version) + 1;

    const newTemplate = await this.prisma.agreementTemplate.create({
      data: {
        organizationId,
        name: dto?.name ? dto.name.trim() : existing.name,
        agreementType: existing.agreementType,
        description: dto?.description !== undefined ? dto.description : existing.description,
        content: dto?.content !== undefined ? dto.content : existing.content,
        version: nextVersion,
        status: TemplateStatus.DRAFT,
      },
    });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          action: 'AGREEMENT_TEMPLATE_CREATED',
          resourceType: 'AGREEMENT_TEMPLATE',
          resourceId: newTemplate.id,
          metadata: { previousTemplateId: existing.id, version: nextVersion },
        },
      });
    }

    return newTemplate as unknown as AgreementTemplateDto;
  }
}
