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
  signatures?: Array<{
    signerType: AgreementSignerType;
    signerName: string;
    status: string;
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
        margin: 50,
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
        .fontSize(20)
        .font('Helvetica-Bold')
        .fillColor('#0f766e')
        .text('PROPERTYOS DIGITAL AGREEMENT', { align: 'center' });

      doc.moveDown(0.5);
      doc
        .fontSize(13)
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text(options.agreementType.replace(/_/g, ' '), { align: 'center' });

      doc.moveDown(0.3);
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#64748b')
        .text(`Document Version ${options.version} • Generated: ${options.generatedAt.toISOString().split('T')[0]}`, {
          align: 'center',
        });

      doc.moveDown(1);
      doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // Metadata Table / Box
      const metaY = doc.y;
      doc
        .rect(50, metaY, 495, 48)
        .fillAndStroke('#f8fafc', '#e2e8f0');

      doc
        .fillColor('#334155')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('Tenant: ', 60, metaY + 8, { continued: true })
        .font('Helvetica')
        .text(options.tenantName, { continued: true })
        .font('Helvetica-Bold')
        .text('    Property: ', { continued: true })
        .font('Helvetica')
        .text(options.propertyName);

      doc
        .font('Helvetica-Bold')
        .text('SHA-256 Hash: ', 60, metaY + 26, { continued: true })
        .font('Courier')
        .fontSize(8)
        .fillColor('#0f766e')
        .text(options.contentHash);

      doc.y = metaY + 60;
      doc.moveDown(0.5);

      // Rendered Agreement Content Body
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#0f172a')
        .text(options.renderedContent, 50, doc.y, {
          align: 'left',
          lineGap: 4,
          paragraphGap: 10,
        });

      doc.moveDown(1.5);
      doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // Signatures Block
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#0f766e')
        .text('DIGITAL SIGNATURE & ACCEPTANCE RECORD');

      doc.moveDown(0.5);

      if (options.signatures && options.signatures.length > 0) {
        options.signatures.forEach((sig, index) => {
          doc
            .font('Helvetica-Bold')
            .fontSize(9)
            .fillColor('#334155')
            .text(`Signer ${index + 1}: ${sig.signerName} (${sig.signerType})`, { continued: true })
            .font('Helvetica')
            .fillColor(sig.status === 'SIGNED' ? '#047857' : '#d97706')
            .text(` — Status: ${sig.status}${sig.signedAt ? ` (${new Date(sig.signedAt).toISOString()})` : ''}`);
        });
      } else {
        doc
          .font('Helvetica-Oblique')
          .fontSize(9)
          .fillColor('#64748b')
          .text('Signatures pending digital execution.');
      }

      doc.moveDown(1);
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor('#94a3b8')
        .text(
          'This is a digitally generated application document snapshot. Content integrity is verified by SHA-256 fingerprint.',
          { align: 'center' }
        );

      doc.end();
    });
  }
}
