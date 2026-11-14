/** GeoJSON point as TypeORM reads and writes PostGIS geography columns: [lng, lat]. */
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
}
