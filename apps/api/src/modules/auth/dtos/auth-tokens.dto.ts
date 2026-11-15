import type { UserDto } from '../../users/dtos/user.dto.js';

/** The contract's AuthTokens. */
export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserDto;
}
