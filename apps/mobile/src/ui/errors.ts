import { t, type Lang } from '@bw/shared';
import { ApiError } from '../api/client';

/**
 * What to tell the person about a failed call. English shows the API's message, which is written for
 * people; Bangla shows our own wording for the common codes, since the API speaks English.
 */
export function errorMessage(error: unknown, lang: Lang): string {
  if (!(error instanceof ApiError)) return t('errGeneric', lang);
  if (error.code === 'NETWORK') return t('networkError', lang);
  if (lang === 'en' && error.message) return error.message;
  switch (error.code) {
    case 'INVALID_STATE':
      return t('errInvalidState', lang);
    case 'NOT_FOUND':
      return t('errNotFound', lang);
    case 'VALIDATION_ERROR':
      return t('errValidation', lang);
    case 'FORBIDDEN':
      return t('errForbidden', lang);
    default:
      return t('errGeneric', lang);
  }
}
