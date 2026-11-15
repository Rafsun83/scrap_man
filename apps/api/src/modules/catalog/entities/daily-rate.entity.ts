import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'daily_rates' })
export class DailyRateEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'category_id', type: 'uuid', nullable: false })
  categoryId: string;

  @Column({ name: 'effective_date', type: 'date', nullable: false })
  effectiveDate: string;

  @Column({ name: 'rate_per_kg', type: 'numeric', precision: 10, scale: 2, nullable: false })
  ratePerKg: string;

  @Column({ name: 'published_by', type: 'uuid', nullable: true })
  publishedBy: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: false, default: () => 'now()' })
  publishedAt: Date;
}
