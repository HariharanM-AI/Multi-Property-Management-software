import { Injectable, BadRequestException } from '@nestjs/common';
import { IStorageDriver, UploadedFileResult } from './storage.interface';
import * as fs from 'fs';
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
export class LocalStorageDriver implements IStorageDriver {
  private readonly baseUploadDir: string;

  constructor() {
    this.baseUploadDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(this.baseUploadDir)) {
      fs.mkdirSync(this.baseUploadDir, { recursive: true });
    }
  }

  validateFile(file: { originalname: string; mimetype: string; size: number }): void {
    if (!file || !file.mimetype || !file.originalname) {
      throw new BadRequestException('Invalid file upload payload');
    }

    const normalizedMime = file.mimetype.toLowerCase();
    const validExtensions = ALLOWED_MIME_TYPES.get(normalizedMime);

    if (!validExtensions) {
      throw new BadRequestException(
        `Unsupported file type '${file.mimetype}'. Allowed: JPEG, PNG, WEBP, PDF`
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

    // Sanitize and defend against path traversal
    const safeOrgId = path.basename(organizationId);
    const safePropertyId = path.basename(propertyId);

    const ext = path.extname(file.originalname).toLowerCase();
    const randomFileName = `${crypto.randomUUID()}${ext}`;

    const targetDir = path.join(this.baseUploadDir, safeOrgId, safePropertyId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetFilePath = path.join(targetDir, randomFileName);
    await fs.promises.writeFile(targetFilePath, file.buffer);

    const fileUrl = `/uploads/${safeOrgId}/${safePropertyId}/${randomFileName}`;

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
    try {
      const fileName = path.basename(fileUrl);
      const safeOrgId = path.basename(organizationId);
      const safePropertyId = path.basename(propertyId);

      const filePath = path.join(this.baseUploadDir, safeOrgId, safePropertyId, fileName);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
