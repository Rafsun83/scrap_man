import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** A selfie a collector uploaded for their application (private storage). */
@Entity({ name: 'collector_selfies' })
export class CollectorSelfieEntity {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: false })
  userId: string;

  @Column({ name: 'storage_key', type: 'text', nullable: false })
  storageKey: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
