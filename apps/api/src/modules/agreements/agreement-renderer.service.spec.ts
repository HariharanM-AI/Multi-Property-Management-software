import { BadRequestException } from '@nestjs/common';
import { AgreementRendererService, AgreementRenderingContext } from './agreement-renderer.service';

describe('AgreementRendererService', () => {
  let service: AgreementRendererService;

  beforeEach(() => {
    service = new AgreementRendererService();
  });

  it('renders whitelisted placeholders and computes SHA-256 hash', () => {
    const template = 'Agreement between {{TENANT_NAME}} and {{PROPERTY_NAME}} for rent {{MONTHLY_RENT}}.';
    const context: AgreementRenderingContext = {
      TENANT_NAME: 'John Doe',
      PROPERTY_NAME: 'Grand Residency',
      MONTHLY_RENT: '₹15,000',
    };

    const result = service.renderTemplate(template, context);

    expect(result.renderedContent).toBe('Agreement between John Doe and Grand Residency for rent ₹15,000.');
    expect(result.contentHash).toBeDefined();
    expect(result.contentHash.length).toBe(64); // 64 hex characters for SHA-256
    expect(result.contentHash).toBe(service.computeSha256(result.renderedContent));
  });

  it('rejects unwhitelisted / unknown placeholders with BadRequestException', () => {
    const maliciousTemplate = 'Welcome {{TENANT_NAME}}, your script is {{eval(malicious_code)}}';
    const context: AgreementRenderingContext = {
      TENANT_NAME: 'John Doe',
    };

    expect(() => service.renderTemplate(maliciousTemplate, context)).toThrow(BadRequestException);
    expect(() => service.renderTemplate(maliciousTemplate, context)).toThrow(
      /Unsupported or unwhitelisted placeholder/
    );
  });

  it('rejects empty template content', () => {
    expect(() => service.renderTemplate('', {})).toThrow(BadRequestException);
  });
});
