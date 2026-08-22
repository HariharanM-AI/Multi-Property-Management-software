import { Injectable } from '@nestjs/common';
import { LocalStorageDriver } from './local-storage.driver';
import { IStorageDriver, UploadedFileResult } from './storage.interface';

@Injectable()
export class StorageService implements IStorageDriver {
  private readonly activeDriver: IStorageDriver;

  constructor(private readonly localDriver: LocalStorageDriver) {
    // In local development or testing, use local storage driver.
    // In future cloud environments, GCSStorageDriver can be injected without altering property domain logic.
    this.activeDriver = this.localDriver;
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
