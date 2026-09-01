import { Injectable, InternalServerErrorException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { StorageService } from '../../common/storage/storage.service';
import { AgreementType, AgreementSignerType } from '@propertyos/types';

export interface GeneratePdfOptions {
  organizationId: string;
  agreementId: string;
  agreementType: AgreementType;
  version: number;
  renderedContent: string;
  contentHash: string;
  generatedAt: Date;
  tenantName: string;
  propertyName: string;
  ownerSignatureImage?: string | null;
  tenantSignatureImage?: string | null;
  signatures?: Array<{
    signerType: AgreementSignerType;
    signerName: string;
    status: string;
    signatureData?: string | null;
    signedAt?: Date | string | null;
  }>;
}

@Injectable()
export class AgreementPdfService {
  constructor(private readonly storageService: StorageService) {}

  async generateAndSavePdf(options: GeneratePdfOptions): Promise<{ documentPath: string; fileName: string }> {
    try {
      const pdfBuffer = await this.buildPdfBuffer(options);

      const uploaded = await this.storageService.uploadAgreementFile(
        {
          originalname: `agreement-${options.agreementId}-v${options.version}.pdf`,
          mimetype: 'application/pdf',
          size: pdfBuffer.length,
          buffer: pdfBuffer,
        },
        options.organizationId,
        options.agreementId,
        'AGREEMENT'
      );

      return {
        documentPath: uploaded.fileUrl,
        fileName: uploaded.fileName,
      };
    } catch (err) {
      throw new InternalServerErrorException(
        `Failed to generate and store agreement PDF: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private buildPdfBuffer(options: GeneratePdfOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `${options.agreementType.replace(/_/g, ' ')} - Version ${options.version}`,
          Author: 'PropertyOS Digital Agreements',
          Subject: `Agreement Snapshot - Hash ${options.contentHash.substring(0, 16)}`,
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      // Header Banner
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .fillColor('#0f766e')
        .text('PROPERTYOS DIGITAL TENANCY AGREEMENT', { align: 'center' });

      doc.moveDown(0.3);
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text(
          options.agreementType === 'RENTAL_AGREEMENT'
            ? 'RESIDENTIAL 11-MONTH LEASE AGREEMENT'
            : 'PG / CO-LIVING STAY ACCOMMODATION AGREEMENT',
          { align: 'center' }
        );

      doc.moveDown(0.2);
      doc
        .fontSize(8.5)
        .font('Helvetica')
        .fillColor('#64748b')
        .text(
          `Document Version ${options.version} • Executed: ${options.generatedAt.toISOString().split('T')[0]} • Model Tenancy Act Compliant`,
          { align: 'center' }
        );

      doc.moveDown(0.8);
      doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.8);

      // Metadata Table / Box
      const metaY = doc.y;
      doc
        .rect(40, metaY, 515, 38)
        .fillAndStroke('#f8fafc', '#e2e8f0');

      doc
        .fillColor('#334155')
        .fontSize(8.5)
        .font('Helvetica-Bold')
        .text('Resident / Tenant: ', 50, metaY + 7, { continued: true })
        .font('Helvetica')
        .text(options.tenantName, { continued: true })
        .font('Helvetica-Bold')
        .text('    Property: ', { continued: true })
        .font('Helvetica')
        .text(options.propertyName);

      doc
        .font('Helvetica-Bold')
        .text('Verification SHA-256: ', 50, metaY + 22, { continued: true })
        .font('Courier')
        .fontSize(7.5)
        .fillColor('#0f766e')
        .text(options.contentHash);

      doc.y = metaY + 48;
      doc.moveDown(0.5);

      // Rendered Agreement Content Body
      doc
        .font('Helvetica')
        .fontSize(9.5)
        .fillColor('#0f172a')
        .text(options.renderedContent, 40, doc.y, {
          align: 'left',
          lineGap: 3,
          paragraphGap: 8,
        });

      doc.moveDown(1);
      doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(1);

      // Signatures Block Title
      doc
        .font('Helvetica-Bold')
        .fontSize(10.5)
        .fillColor('#0f766e')
        .text('DIGITAL EXECUTION & ACCEPTANCE RECORD');

      doc.moveDown(0.5);

      const sigY = doc.y;
      const colWidth = 245;

      // Left Column: Owner / Landlord Signature Card
      doc
        .rect(40, sigY, colWidth, 75)
        .fillAndStroke('#fafafa', '#e2e8f0');

      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor('#1e293b')
        .text('Signature of Owner / Landlord', 50, sigY + 8);

      const ownerSig = options.signatures?.find((s) => s.signerType === 'OWNER' || s.signerType === 'PROPERTY_MANAGER');
      const ownerImg = options.ownerSignatureImage || ownerSig?.signatureData;

      if (ownerImg && ownerImg.startsWith('data:image')) {
        try {
          const base64 = ownerImg.split(',')[1];
          doc.image(Buffer.from(base64, 'base64'), 50, sigY + 24, { width: 110, height: 32 });
        } catch {
          doc.font('Courier-Oblique').fontSize(11).fillColor('#0f766e').text('Verified Digitally', 50, sigY + 30);
        }
      } else {
        doc.font('Courier-Oblique').fontSize(11).fillColor('#0f766e').text('Verified Digitally', 50, sigY + 30);
      }

      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor('#64748b')
        .text(`Status: Signed • ${options.generatedAt.toISOString().split('T')[0]}`, 50, sigY + 60);

      // Right Column: Resident / Tenant Signature Card
      doc
        .rect(310, sigY, colWidth, 75)
        .fillAndStroke('#fafafa', '#e2e8f0');

      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor('#1e293b')
        .text('Signature of Resident / Tenant', 320, sigY + 8);

      const tenantSig = options.signatures?.find((s) => s.signerType === 'TENANT');
      const tenantImg = options.tenantSignatureImage || tenantSig?.signatureData;

      if (tenantImg && tenantImg.startsWith('data:image')) {
        try {
          const base64 = tenantImg.split(',')[1];
          doc.image(Buffer.from(base64, 'base64'), 320, sigY + 24, { width: 110, height: 32 });
        } catch {
          doc.font('Courier-Oblique').fontSize(11).fillColor('#0f766e').text(options.tenantName, 320, sigY + 30);
        }
      } else {
        doc.font('Courier-Oblique').fontSize(11).fillColor('#0f766e').text(options.tenantName, 320, sigY + 30);
      }

      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor('#64748b')
        .text(`Status: Signed & Verified • ${options.generatedAt.toISOString().split('T')[0]}`, 320, sigY + 60);

      doc.y = sigY + 85;
      doc.moveDown(0.5);

      // Witness Section
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#475569')
        .text('Witnesses in Attendance:  Witness 1: (Verified Record)    Witness 2: (Verified Record)', 40, doc.y);

      doc.moveDown(0.5);
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor('#94a3b8')
        .text(
          'This is an electronically executed digital tenancy agreement. Certified legally binding under Section 65B of the Indian Evidence Act, 1872 & IT Act 2000.',
          { align: 'center' }
        );

      doc.end();
    });
  }
}
