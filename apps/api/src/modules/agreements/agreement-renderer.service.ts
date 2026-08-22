import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

export interface AgreementRenderingContext {
  TENANT_NAME?: string;
  TENANT_FIRST_NAME?: string;
  TENANT_LAST_NAME?: string;
  TENANT_PHONE?: string;
  TENANT_EMAIL?: string;
  TENANT_ADDRESS?: string;
  TENANT_CITY?: string;
  TENANT_STATE?: string;
  TENANT_POSTAL_CODE?: string;

  EMERGENCY_CONTACT_NAME?: string;
  EMERGENCY_CONTACT_PHONE?: string;
  EMERGENCY_CONTACT_RELATION?: string;

  PROPERTY_NAME?: string;
  PROPERTY_CODE?: string;
  PROPERTY_ADDRESS?: string;
  PROPERTY_CITY?: string;
  PROPERTY_STATE?: string;
  PROPERTY_POSTAL_CODE?: string;

  LEASE_START_DATE?: string;
  LEASE_END_DATE?: string;
  MONTHLY_RENT?: string;
  SECURITY_DEPOSIT?: string;

  UNIT_NUMBER?: string;

  FLOOR_NUMBER?: string;
  ROOM_NUMBER?: string;
  BED_NUMBER?: string;

  CHECK_IN_DATE?: string;
  AGREEMENT_DATE?: string;
}

export const WHITELISTED_PLACEHOLDERS = new Set<string>([
  'TENANT_NAME',
  'TENANT_FIRST_NAME',
  'TENANT_LAST_NAME',
  'TENANT_PHONE',
  'TENANT_EMAIL',
  'TENANT_ADDRESS',
  'TENANT_CITY',
  'TENANT_STATE',
  'TENANT_POSTAL_CODE',
  'EMERGENCY_CONTACT_NAME',
  'EMERGENCY_CONTACT_PHONE',
  'EMERGENCY_CONTACT_RELATION',
  'PROPERTY_NAME',
  'PROPERTY_CODE',
  'PROPERTY_ADDRESS',
  'PROPERTY_CITY',
  'PROPERTY_STATE',
  'PROPERTY_POSTAL_CODE',
  'LEASE_START_DATE',
  'LEASE_END_DATE',
  'MONTHLY_RENT',
  'SECURITY_DEPOSIT',
  'UNIT_NUMBER',
  'FLOOR_NUMBER',
  'ROOM_NUMBER',
  'BED_NUMBER',
  'CHECK_IN_DATE',
  'AGREEMENT_DATE',
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
