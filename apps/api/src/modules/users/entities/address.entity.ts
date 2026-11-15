import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { GeoPoint } from '../../../common/geo.js';

@Entity({ name: 'addresses' })
export class AddressEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: false })
  userId: string;

  @Column({ name: 'label', type: 'varchar', length: 40, nullable: false })
  label: string;

  @Column({ name: 'line', type: 'varchar', length: 200, nullable: false })
  line: string;

  @Column({ name: 'area', type: 'varchar', length: 80, nullable: false })
  area: string;

  @Column({ name: 'city', type: 'varchar', length: 40, nullable: false, default: 'Dhaka' })
  city: string;

  @Column({ name: 'location', type: 'geography', spatialFeatureType: 'Point', srid: 4326, nullable: false })
  location: GeoPoint;

  @Column({ name: 'note', type: 'varchar', length: 200, nullable: true })
  note: string | null;

  @Column({ name: 'is_default', type: 'boolean', nullable: false, default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
