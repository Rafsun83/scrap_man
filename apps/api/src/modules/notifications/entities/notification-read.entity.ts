import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Each user's "seen up to" time for the notification feed. */
@Entity({ name: 'notification_reads' })
export class NotificationReadEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'seen_at', type: 'timestamptz', nullable: false })
  seenAt: Date;
}
