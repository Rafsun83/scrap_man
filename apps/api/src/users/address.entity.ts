import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { GeoPoint as Point } from '../common/geo.js';

@Entity('addresses')
export class AddressEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 40 })
  label: string;

  @Column({ type: 'varchar', length: 200 })
  line: string;

  @Column({ type: 'varchar', length: 80 })
  area: string;

  @Column({ type: 'varchar', length: 40, default: 'Dhaka' })
  city: string;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location: Point;

  @Column({ type: 'varchar', length: 200, nullable: true })
  note: string | null;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

export function toPoint(lat: number, lng: number): Point {
  return { type: 'Point', coordinates: [lng, lat] };
}

/** The Address shape from the API contract; GeoJSON stores [lng, lat]. */
export function toAddressDto(a: AddressEntity) {
  return {
    id: a.id,
    label: a.label,
    line: a.line,
    area: a.area,
    city: a.city,
    location: { lat: a.location.coordinates[1], lng: a.location.coordinates[0] },
    note: a.note,
    isDefault: a.isDefault,
  };
}
