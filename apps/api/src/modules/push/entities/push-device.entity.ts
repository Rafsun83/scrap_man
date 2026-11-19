import { Column, Entity, PrimaryColumn } from 'typeorm';
import { DEVICE_PLATFORMS, type DevicePlatform } from '@bw/shared';

/** A phone that receives push notifications; the token belongs to one user at a time. */
@Entity({ name: 'push_devices' })
export class PushDeviceEntity {
  @PrimaryColumn({ name: 'token', type: 'text' })
  token: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: false })
  userId: string;

  @Column({ name: 'platform', type: 'varchar', length: 10, nullable: false, enum: DEVICE_PLATFORMS })
  platform: DevicePlatform;

  @Column({ name: 'created_at', type: 'timestamptz', nullable: false, default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: false, default: () => 'now()' })
  lastSeenAt: Date;
}
