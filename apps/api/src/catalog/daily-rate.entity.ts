import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('daily_rates')
export class DailyRateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate: string;

  @Column({ name: 'rate_per_kg', type: 'numeric', precision: 10, scale: 2 })
  ratePerKg: string;

  @Column({ name: 'published_by', type: 'uuid', nullable: true })
  publishedBy: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', default: () => 'now()' })
  publishedAt: Date;
}
