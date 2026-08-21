import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { LocalStorageDriver } from './local-storage.driver';

@Module({
  providers: [LocalStorageDriver, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
