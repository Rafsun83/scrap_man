/** The contract's NearbyCollector: anonymous, blurred position of one collector around a request. */
export interface NearbyCollectorDto {
  distanceM: number;
  bearingDeg: number;
}

/** The contract's NearbyCollectors (H5 radar). */
export interface NearbyCollectorsDto {
  radiusM: number;
  count: number;
  collectors: NearbyCollectorDto[];
}
