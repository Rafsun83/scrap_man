import { localDigits, type Lang } from '@bw/shared';
import type { Category } from '../api/types';

const PHONE_RE = /^\+8801[3-9][0-9]{8}$/;

/**
 * Turns what a person types (Bangla or ASCII digits, with or without 0 / 880 / +880) into the API's
 * +8801XXXXXXXXX form. Returns null if it is not a Bangladeshi mobile number.
 */
export function normalizePhone(input: string): string | null {
  const ascii = input.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/[^0-9]/g, '');
  let local = ascii;
  if (local.startsWith('880')) local = local.slice(3);
  if (local.startsWith('0')) local = local.slice(1);
  const phone = `+880${local}`;
  return PHONE_RE.test(phone) ? phone : null;
}

/** "+৮৮০ ১৭১২-৩৪৫৪৫৬" for display. */
export function formatPhone(phone: string, lang: Lang): string {
  const m = /^\+880(\d{4})(\d{6})$/.exec(phone);
  const text = m ? `+880 ${m[1]}-${m[2]}` : phone;
  return localDigits(text, lang);
}

/** "01712345456": the local form people recognise for wallet numbers. */
export function localPhone(phone: string, lang: Lang): string {
  return localDigits(phone.replace(/^\+88/, ''), lang);
}

export function categoryName(categories: Category[] | undefined, code: string, lang: Lang): string {
  const c = categories?.find((x) => x.code === code);
  if (!c) return code;
  return (lang === 'bn' ? c.nameBn : c.nameEn) ?? code;
}

export function categoryNames(categories: Category[] | undefined, codes: string[], lang: Lang): string {
  return codes.map((code) => categoryName(categories, code, lang)).join(', ');
}

/** Kilometres with one decimal for distances, e.g. 1.2. */
export function formatKm(metres: number, lang: Lang): string {
  return localDigits((metres / 1000).toFixed(1), lang);
}

/** Great-circle distance in metres. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Rough arrival time from straight-line distance. Dhaka streets are slow and winding, so assume
 * 10 km/h along a path 1.4x the straight line; never less than 2 minutes.
 */
export function etaMinutes(metres: number): number {
  return Math.max(2, Math.round(((metres * 1.4) / 10_000) * 60));
}

/** Initials for an avatar: the first letter of the first two words. */
export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => Array.from(w)[0])
    .join('');
}

/** The API only accepts points inside Bangladesh (a loose box that catches swapped lat/lng). */
export function insideBangladesh(p: { lat: number; lng: number }) {
  return p.lat >= 20.5 && p.lat <= 26.7 && p.lng >= 88 && p.lng <= 92.7;
}
