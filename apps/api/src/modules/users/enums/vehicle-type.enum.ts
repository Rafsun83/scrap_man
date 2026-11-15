/** collector_profiles.vehicle_type (Postgres enum vehicle_type). */
export const VEHICLE_TYPES = ['VAN', 'PUSHCART', 'ON_FOOT'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];
