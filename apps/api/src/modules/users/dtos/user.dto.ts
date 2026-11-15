import type { Role } from '@bw/shared';
import type { Language } from '../enums/language.enum.js';
import type { UserStatus } from '../enums/user-status.enum.js';

/** The contract's User. */
export interface UserDto {
  id: string;
  phone: string;
  role: Role;
  name: string | null;
  language: Language;
  status: UserStatus;
  createdAt: string;
}
