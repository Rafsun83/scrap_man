import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { CategoryEntity } from './category.entity.js';
import { DailyRateEntity } from './daily-rate.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([CategoryEntity, DailyRateEntity])],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
