import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { GeoPoint as Point } from '../common/geo.js';

export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type VehicleType = 'VAN' | 'PUSHCART' | 'ON_FOOT';

/** Collector sign-up and verification; the endpoints arrive with the collector app in M4. */
@Entity('collector_profiles')
export class CollectorProfileEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'nid_number', type: 'varchar', length: 17 })
  nidNumber: string;

  @Column({ name: 'nid_verified', type: 'boolean', default: false })
  nidVerified: boolean;

  @Column({ name: 'selfie_url', type: 'text', nullable: true })
  selfieUrl: string | null;

  @Column({ name: 'work_areas', type: 'text', array: true, default: () => "'{}'" })
  workAreas: string[];

  @Column({ name: 'vehicle_type', type: 'enum', enumName: 'vehicle_type', enum: ['VAN', 'PUSHCART', 'ON_FOOT'] })
  vehicleType: VehicleType;

  @Column({ name: 'has_scale', type: 'boolean', default: false })
  hasScale: boolean;

  @Column({
    name: 'verification_status',
    type: 'enum',
    enumName: 'verification_status',
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
  })
  verificationStatus: VerificationStatus;

  @Column({ name: 'is_online', type: 'boolean', default: false })
  isOnline: boolean;

  @Column({ name: 'last_location', type: 'geography', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  lastLocation: Point | null;

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  @Column({ name: 'rating_avg', type: 'numeric', precision: 2, scale: 1, nullable: true })
  ratingAvg: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
