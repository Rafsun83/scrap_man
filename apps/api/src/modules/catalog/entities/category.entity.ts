import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { PRICING_TYPES, type PricingType } from '../enums/pricing-type.enum.js';

@Entity({ name: 'categories' })
export class CategoryEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'code', type: 'varchar', length: 30, nullable: false })
  code: string;

  @Column({ name: 'name_bn', type: 'varchar', length: 60, nullable: false })
  nameBn: string;

  @Column({ name: 'name_en', type: 'varchar', length: 60, nullable: false })
  nameEn: string;

  @Column({ name: 'pricing_type', type: 'enum', enumName: 'pricing_type', enum: PRICING_TYPES, nullable: false })
  pricingType: PricingType;

  @Column({ name: 'icon', type: 'varchar', length: 40, nullable: false })
  icon: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false, default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'smallint', nullable: false, default: 0 })
  sortOrder: number;
}
