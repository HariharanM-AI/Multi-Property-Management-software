import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { LocalStorageDriver } from './local-storage.driver';
import { R2StorageDriver } from './r2-storage.driver';

@Module({
  providers: [LocalStorageDriver, R2StorageDriver, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
