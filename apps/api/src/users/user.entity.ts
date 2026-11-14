import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { Role } from '@bw/shared';

export type UserStatus = 'ACTIVE' | 'FLAGGED' | 'SUSPENDED';
export type Language = 'BN' | 'EN';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 14 })
  phone: string;

  @Column({ type: 'enum', enumName: 'user_role', enum: ['HOUSEHOLD', 'COLLECTOR', 'ADMIN'] })
  role: Role;

  @Column({ type: 'varchar', length: 80, nullable: true })
  name: string | null;

  @Column({ type: 'enum', enumName: 'app_language', enum: ['BN', 'EN'], default: 'BN' })
  language: Language;

  @Column({ type: 'enum', enumName: 'user_status', enum: ['ACTIVE', 'FLAGGED', 'SUSPENDED'], default: 'ACTIVE' })
  status: UserStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

/** The User shape from the API contract. */
export function toUserDto(user: UserEntity) {
  return {
    id: user.id,
    phone: user.phone,
    role: user.role,
    name: user.name,
    language: user.language,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}
