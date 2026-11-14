import { z } from 'zod';

/** Bangladeshi mobile numbers in the contract's format: +8801 then an operator digit 3-9 and 8 digits. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+8801[3-9][0-9]{8}$/, 'Use the format +8801XXXXXXXXX.');
