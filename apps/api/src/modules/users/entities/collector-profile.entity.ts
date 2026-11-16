import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { GeoPoint } from '../../../common/geo.js';
import { VEHICLE_TYPES, type VehicleType } from '../enums/vehicle-type.enum.js';
import { VERIFICATION_STATUSES, type VerificationStatus } from '../enums/verification-status.enum.js';

/** Collector sign-up and verification (C6, C7) and availability for matching. */
@Entity({ name: 'collector_profiles' })
export class CollectorProfileEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'nid_number', type: 'varchar', length: 17, nullable: false })
  nidNumber: string;

  @Column({ name: 'nid_verified', type: 'boolean', nullable: false, default: false })
  nidVerified: boolean;

  /** The selfie submitted with the application (collector_selfies). */
  @Column({ name: 'selfie_id', type: 'uuid', nullable: true })
  selfieId: string | null;

  @Column({ name: 'work_areas', type: 'text', array: true, nullable: false, default: () => "'{}'" })
  workAreas: string[];

  @Column({ name: 'vehicle_type', type: 'enum', enumName: 'vehicle_type', enum: VEHICLE_TYPES, nullable: false })
  vehicleType: VehicleType;

  @Column({ name: 'has_scale', type: 'boolean', nullable: false, default: false })
  hasScale: boolean;

  @Column({
    name: 'verification_status',
    type: 'enum',
    enumName: 'verification_status',
    enum: VERIFICATION_STATUSES,
    nullable: false,
    default: 'PENDING',
  })
  verificationStatus: VerificationStatus;

  @Column({ name: 'verification_note', type: 'varchar', length: 500, nullable: true })
  verificationNote: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: false, default: () => 'now()' })
  submittedAt: Date;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy: string | null;

  @Column({ name: 'is_online', type: 'boolean', nullable: false, default: false })
  isOnline: boolean;

  @Column({ name: 'last_location', type: 'geography', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  lastLocation: GeoPoint | null;

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  @Column({ name: 'rating_avg', type: 'numeric', precision: 2, scale: 1, nullable: true })
  ratingAvg: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
