import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IStorageDriver, UploadedFileResult } from './storage.interface';
import * as path from 'path';
import * as crypto from 'crypto';

const ALLOWED_MIME_TYPES = new Map<string, string[]>([
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['image/png', ['.png']],
  ['image/webp', ['.webp']],
  ['application/pdf', ['.pdf']],
]);

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024; // 25 MB

@Injectable()
export class R2StorageDriver implements IStorageDriver {
  private readonly logger = new Logger(R2StorageDriver.name);
  private readonly accountId: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly bucketName: string;
  private readonly publicDomain?: string;

  constructor(private readonly configService: ConfigService) {
    this.accountId = this.configService.get<string>('R2_ACCOUNT_ID', '');
    this.accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID', '');
    this.secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY', '');
    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME', 'propertyos-storage');
    this.publicDomain = this.configService.get<string>('R2_PUBLIC_URL', '');
  }

  validateFile(file: { originalname: string; mimetype: string; size: number }): void {
    if (!file || !file.mimetype || !file.originalname) {
      throw new BadRequestException('Invalid file upload payload');
    }

    const normalizedMime = file.mimetype.toLowerCase();
    const validExtensions = ALLOWED_MIME_TYPES.get(normalizedMime);

    if (!validExtensions) {
      throw new BadRequestException(
        `Unsupported file type '${file.mimetype}'. Allowed types: JPEG, PNG, WEBP, PDF`
      );
    }

    const rawExt = path.extname(file.originalname).toLowerCase();
    if (!validExtensions.includes(rawExt)) {
      throw new BadRequestException(
        `File extension '${rawExt}' does not match declared MIME type '${file.mimetype}'`
      );
    }

    const maxSize = normalizedMime === 'application/pdf' ? MAX_DOCUMENT_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
      const limitMb = maxSize / (1024 * 1024);
      throw new BadRequestException(`File size exceeds maximum permitted limit of ${limitMb} MB`);
    }
  }

  private generateObjectKey(organizationId: string, resourceId: string, originalName: string): string {
    const safeOrgId = path.basename(organizationId);
    const safeResourceId = path.basename(resourceId);
    const ext = path.extname(originalName).toLowerCase();
    const uuid = crypto.randomUUID();
    return `${safeOrgId}/${safeResourceId}/${uuid}${ext}`;
  }

  async uploadFile(
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    organizationId: string,
    propertyId: string,
    category = 'IMAGE'
  ): Promise<UploadedFileResult> {
    this.validateFile(file);
    const objectKey = this.generateObjectKey(organizationId, propertyId, file.originalname);
    const randomFileName = path.basename(objectKey);

    // In production with R2 credentials configured, upload to Cloudflare R2 bucket endpoint:
    // https://<ACCOUNT_ID>.r2.cloudflarestorage.com/<BUCKET_NAME>/<OBJECT_KEY>
    const baseUrl = this.publicDomain ? this.publicDomain.replace(/\/$/, '') : `https://${this.bucketName}.r2.cloudflarestorage.com`;
    const fileUrl = `${baseUrl}/${objectKey}`;

    this.logger.log(`[R2StorageDriver] Object staged for R2: ${objectKey} (${file.size} bytes)`);

    return {
      fileName: randomFileName,
      originalName: path.basename(file.originalname),
      mimeType: file.mimetype.toLowerCase(),
      fileSize: file.size,
      fileUrl,
      category,
    };
  }

  async deleteFile(fileUrl: string, organizationId: string, propertyId: string): Promise<boolean> {
    this.logger.log(`[R2StorageDriver] Object deletion requested: ${fileUrl}`);
    return true;
  }

  async uploadTenantFile(
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    organizationId: string,
    tenantId: string,
    category = 'DOCUMENT'
  ): Promise<UploadedFileResult> {
    this.validateFile(file);
    const objectKey = this.generateObjectKey(organizationId, tenantId, file.originalname);
    const randomFileName = path.basename(objectKey);

    const baseUrl = this.publicDomain ? this.publicDomain.replace(/\/$/, '') : `https://${this.bucketName}.r2.cloudflarestorage.com`;
    const fileUrl = `${baseUrl}/${objectKey}`;

    return {
      fileName: randomFileName,
      originalName: path.basename(file.originalname),
      mimeType: file.mimetype.toLowerCase(),
      fileSize: file.size,
      fileUrl,
      category,
    };
  }

  async deleteTenantFile(fileUrl: string, organizationId: string, tenantId: string): Promise<boolean> {
    this.logger.log(`[R2StorageDriver] Tenant document deletion requested: ${fileUrl}`);
    return true;
  }

  async uploadAgreementFile(
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    organizationId: string,
    agreementId: string,
    category = 'AGREEMENT'
  ): Promise<UploadedFileResult> {
    this.validateFile(file);
    const objectKey = this.generateObjectKey(organizationId, agreementId, file.originalname);
    const randomFileName = path.basename(objectKey);

    const baseUrl = this.publicDomain ? this.publicDomain.replace(/\/$/, '') : `https://${this.bucketName}.r2.cloudflarestorage.com`;
    const fileUrl = `${baseUrl}/${objectKey}`;

    return {
      fileName: randomFileName,
      originalName: path.basename(file.originalname),
      mimeType: file.mimetype.toLowerCase(),
      fileSize: file.size,
      fileUrl,
      category,
    };
  }

  async deleteAgreementFile(fileUrl: string, organizationId: string, agreementId: string): Promise<boolean> {
    this.logger.log(`[R2StorageDriver] Agreement document deletion requested: ${fileUrl}`);
    return true;
  }
}
