import { z } from 'zod';

/** GeoJSON point as TypeORM reads and writes PostGIS geography columns: [lng, lat]. */
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Dhaka-area points only for v1: a loose box around Bangladesh catches swapped lat/lng. */
export const latLngSchema = z.object({
  lat: z.number().min(20.5).max(26.7),
  lng: z.number().min(88).max(92.7),
});

export function toGeoPoint(lat: number, lng: number): GeoPoint {
  return { type: 'Point', coordinates: [lng, lat] };
}
