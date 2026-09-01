import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageDriver } from './local-storage.driver';
import { R2StorageDriver } from './r2-storage.driver';
import { IStorageDriver, UploadedFileResult } from './storage.interface';

@Injectable()
export class StorageService implements IStorageDriver {
  private readonly activeDriver: IStorageDriver;

  constructor(
    private readonly localDriver: LocalStorageDriver,
    private readonly r2Driver: R2StorageDriver,
    private readonly configService: ConfigService
  ) {
    const driverType = this.configService.get<string>('STORAGE_DRIVER', 'local').toLowerCase();
    this.activeDriver = driverType === 'r2' ? this.r2Driver : this.localDriver;
  }

  validateFile(file: { originalname: string; mimetype: string; size: number }): void {
    return this.activeDriver.validateFile(file);
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
    category?: string
  ): Promise<UploadedFileResult> {
    return this.activeDriver.uploadFile(file, organizationId, propertyId, category);
  }

  async deleteFile(fileUrl: string, organizationId: string, propertyId: string): Promise<boolean> {
    return this.activeDriver.deleteFile(fileUrl, organizationId, propertyId);
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
    category?: string
  ): Promise<UploadedFileResult> {
    return this.activeDriver.uploadTenantFile(file, organizationId, tenantId, category);
  }

  async deleteTenantFile(fileUrl: string, organizationId: string, tenantId: string): Promise<boolean> {
    return this.activeDriver.deleteTenantFile(fileUrl, organizationId, tenantId);
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
    category?: string
  ): Promise<UploadedFileResult> {
    return this.activeDriver.uploadAgreementFile(file, organizationId, agreementId, category);
  }

  async deleteAgreementFile(fileUrl: string, organizationId: string, agreementId: string): Promise<boolean> {
    return this.activeDriver.deleteAgreementFile(fileUrl, organizationId, agreementId);
  }
}
