import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogController } from './controllers/catalog.controller.js';
import { CategoryEntity } from './entities/category.entity.js';
import { DailyRateEntity } from './entities/daily-rate.entity.js';
import { CatalogRepository } from './repositories/catalog.repository.js';
import { CatalogService } from './services/catalog.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([CategoryEntity, DailyRateEntity])],
  controllers: [CatalogController],
  providers: [CatalogRepository, CatalogService],
})
export class CatalogModule {}
