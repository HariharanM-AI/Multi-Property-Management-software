import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

export interface AgreementRenderingContext {
  OWNER_NAME?: string;
  LANDLORD_NAME?: string;
  OWNER_ADDRESS?: string;
  LANDLORD_ADDRESS?: string;
  OWNER_PHONE?: string;
  LANDLORD_PHONE?: string;

  RESIDENT_NAME?: string;
  TENANT_NAME?: string;
  TENANT_FIRST_NAME?: string;
  TENANT_LAST_NAME?: string;
  TENANT_PHONE?: string;
  TENANT_EMAIL?: string;
  RESIDENT_PERMANENT_ADDRESS?: string;
  TENANT_PERMANENT_ADDRESS?: string;
  TENANT_ADDRESS?: string;
  TENANT_CITY?: string;
  TENANT_STATE?: string;
  TENANT_POSTAL_CODE?: string;

  PG_PROPERTY_ADDRESS?: string;
  RENTED_PROPERTY_ADDRESS?: string;
  PROPERTY_NAME?: string;
  PROPERTY_CODE?: string;
  PROPERTY_ADDRESS?: string;
  PROPERTY_CITY?: string;
  PROPERTY_STATE?: string;
  PROPERTY_POSTAL_CODE?: string;

  ALLOCATED_ROOM_BED_NO?: string;
  SHARING_TYPE?: string;
  UNIT_NUMBER?: string;
  FLOOR_NUMBER?: string;
  ROOM_NUMBER?: string;
  BED_NUMBER?: string;

  ID_PROOF_TYPE?: string;
  ID_PROOF_NUMBER?: string;

  MONTHLY_PG_RENT?: string;
  MONTHLY_RENT?: string;
  RENT_PAYMENT_DUE_DAY?: string;
  SECURITY_DEPOSIT_AMOUNT?: string;
  SECURITY_DEPOSIT?: string;

  LEASE_START_DATE?: string;
  LEASE_END_DATE?: string;
  AGREEMENT_START_DATE?: string;
  AGREEMENT_END_DATE?: string;
  TENANCY_PERIOD?: string;
  NOTICE_PERIOD_DAYS?: string;
  LOCK_IN_MONTHS?: string;
  LOCK_IN_PERIOD_VALUE?: string;
  LOCK_IN_PERIOD_UNIT?: string;

  AGREEMENT_DAY?: string;
  AGREEMENT_MONTH?: string;
  AGREEMENT_YEAR?: string;
  AGREEMENT_DATE?: string;
  CHECK_IN_DATE?: string;

  EMERGENCY_CONTACT_NAME?: string;
  EMERGENCY_CONTACT_PHONE?: string;
  EMERGENCY_CONTACT_RELATION?: string;
}

export const WHITELISTED_PLACEHOLDERS = new Set<string>([
  'OWNER_NAME',
  'LANDLORD_NAME',
  'OWNER_ADDRESS',
  'LANDLORD_ADDRESS',
  'OWNER_PHONE',
  'LANDLORD_PHONE',
  'RESIDENT_NAME',
  'TENANT_NAME',
  'TENANT_FIRST_NAME',
  'TENANT_LAST_NAME',
  'TENANT_PHONE',
  'TENANT_EMAIL',
  'RESIDENT_PERMANENT_ADDRESS',
  'TENANT_PERMANENT_ADDRESS',
  'TENANT_ADDRESS',
  'TENANT_CITY',
  'TENANT_STATE',
  'TENANT_POSTAL_CODE',
  'PG_PROPERTY_ADDRESS',
  'RENTED_PROPERTY_ADDRESS',
  'PROPERTY_NAME',
  'PROPERTY_CODE',
  'PROPERTY_ADDRESS',
  'PROPERTY_CITY',
  'PROPERTY_STATE',
  'PROPERTY_POSTAL_CODE',
  'ALLOCATED_ROOM_BED_NO',
  'SHARING_TYPE',
  'UNIT_NUMBER',
  'FLOOR_NUMBER',
  'ROOM_NUMBER',
  'BED_NUMBER',
  'ID_PROOF_TYPE',
  'ID_PROOF_NUMBER',
  'MONTHLY_PG_RENT',
  'MONTHLY_RENT',
  'RENT_PAYMENT_DUE_DAY',
  'SECURITY_DEPOSIT_AMOUNT',
  'SECURITY_DEPOSIT',
  'LEASE_START_DATE',
  'LEASE_END_DATE',
  'AGREEMENT_START_DATE',
  'AGREEMENT_END_DATE',
  'TENANCY_PERIOD',
  'NOTICE_PERIOD_DAYS',
  'LOCK_IN_MONTHS',
  'LOCK_IN_PERIOD_VALUE',
  'LOCK_IN_PERIOD_UNIT',
  'AGREEMENT_DAY',
  'AGREEMENT_MONTH',
  'AGREEMENT_YEAR',
  'AGREEMENT_DATE',
  'CHECK_IN_DATE',
  'EMERGENCY_CONTACT_NAME',
  'EMERGENCY_CONTACT_PHONE',
  'EMERGENCY_CONTACT_RELATION',
]);

@Injectable()
export class AgreementRendererService {
  /**
   * Evaluates template content against strict whitelisted placeholder tokens.
   * Unknown/unsupported placeholders reject generation with 400 Bad Request.
   */
  renderTemplate(
    templateContent: string,
    context: AgreementRenderingContext
  ): { renderedContent: string; contentHash: string } {
    if (!templateContent) {
      throw new BadRequestException('Template content cannot be empty');
    }

    // Extract all {{TOKEN}} matches
    const tokenRegex = /\{\{([^{}]+)\}\}/g;
    let match: RegExpExecArray | null;
    const tokensInTemplate = new Set<string>();

    while ((match = tokenRegex.exec(templateContent)) !== null) {
      const rawToken = match[1].trim();
      tokensInTemplate.add(rawToken);
    }

    // Validate that all tokens are strictly whitelisted
    for (const token of tokensInTemplate) {
      if (!WHITELISTED_PLACEHOLDERS.has(token)) {
        throw new BadRequestException(
          `Unsupported or unwhitelisted placeholder '{{${token}}}' found in template content`
        );
      }
    }

    // Perform deterministic placeholder replacement
    const renderedContent = templateContent.replace(tokenRegex, (_fullMatch, token) => {
      const cleanToken = token.trim() as keyof AgreementRenderingContext;
      const value = context[cleanToken];
      return value !== undefined && value !== null ? String(value) : '';
    });

    // Compute SHA-256 hash over exact rendered string
    const contentHash = this.computeSha256(renderedContent);

    return {
      renderedContent,
      contentHash,
    };
  }

  /**
   * Deterministic SHA-256 hashing helper
   */
  computeSha256(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }
}
