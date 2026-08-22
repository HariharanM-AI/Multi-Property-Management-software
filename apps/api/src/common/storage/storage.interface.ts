export interface UploadedFileResult {
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  category: string;
}

export interface IStorageDriver {
  uploadFile(
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    organizationId: string,
    propertyId: string,
    category?: string
  ): Promise<UploadedFileResult>;

  deleteFile(fileUrl: string, organizationId: string, propertyId: string): Promise<boolean>;

  uploadTenantFile(
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    organizationId: string,
    tenantId: string,
    category?: string
  ): Promise<UploadedFileResult>;

  deleteTenantFile(fileUrl: string, organizationId: string, tenantId: string): Promise<boolean>;

  validateFile(file: {
    originalname: string;
    mimetype: string;
    size: number;
  }): void;
}
