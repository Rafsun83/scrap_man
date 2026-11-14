import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type PricingType = 'PER_KG' | 'ON_INSPECTION';

@Entity('categories')
export class CategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30 })
  code: string;

  @Column({ name: 'name_bn', type: 'varchar', length: 60 })
  nameBn: string;

  @Column({ name: 'name_en', type: 'varchar', length: 60 })
  nameEn: string;

  @Column({ name: 'pricing_type', type: 'enum', enumName: 'pricing_type', enum: ['PER_KG', 'ON_INSPECTION'] })
  pricingType: PricingType;

  @Column({ type: 'varchar', length: 40 })
  icon: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'smallint', default: 0 })
  sortOrder: number;
}

export function toCategoryDto(c: CategoryEntity) {
  return { code: c.code, nameBn: c.nameBn, nameEn: c.nameEn, pricingType: c.pricingType, icon: c.icon };
}
