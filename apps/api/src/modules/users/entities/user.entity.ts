import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ROLES, type Role } from '@bw/shared';
import { LANGUAGES, type Language } from '../enums/language.enum.js';
import { USER_STATUSES, type UserStatus } from '../enums/user-status.enum.js';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'phone', type: 'varchar', length: 14, nullable: false })
  phone: string;

  @Column({ name: 'role', type: 'enum', enumName: 'user_role', enum: ROLES, nullable: false })
  role: Role;

  @Column({ name: 'name', type: 'varchar', length: 80, nullable: true })
  name: string | null;

  @Column({ name: 'language', type: 'enum', enumName: 'app_language', enum: LANGUAGES, nullable: false, default: 'BN' })
  language: Language;

  @Column({ name: 'status', type: 'enum', enumName: 'user_status', enum: USER_STATUSES, nullable: false, default: 'ACTIVE' })
  status: UserStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
