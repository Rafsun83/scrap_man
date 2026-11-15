import type { LatLng } from '../../../common/geo.js';

/** The contract's Address. */
export interface AddressDto {
  id: string;
  label: string;
  line: string;
  area: string;
  city: string;
  location: LatLng;
  note: string | null;
  isDefault: boolean;
}
