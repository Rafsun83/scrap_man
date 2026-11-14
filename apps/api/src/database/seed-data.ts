/** The six v1 categories, in display order. Codes are stable; names can change. */
export const CATEGORIES = [
  { code: 'IRON', nameBn: 'লোহা', nameEn: 'Iron', pricingType: 'PER_KG', icon: 'iron' },
  { code: 'NEWSPAPER', nameBn: 'পুরোনো পত্রিকা', nameEn: 'Old newspaper', pricingType: 'PER_KG', icon: 'newspaper' },
  { code: 'PLASTIC', nameBn: 'প্লাস্টিক', nameEn: 'Plastic', pricingType: 'PER_KG', icon: 'bottle' },
  { code: 'CARTON', nameBn: 'কার্টন', nameEn: 'Carton', pricingType: 'PER_KG', icon: 'carton' },
  { code: 'ALUMINIUM', nameBn: 'অ্যালুমিনিয়াম', nameEn: 'Aluminium', pricingType: 'PER_KG', icon: 'can' },
  { code: 'ELECTRONICS', nameBn: 'ইলেকট্রনিক্স', nameEn: 'Electronics', pricingType: 'ON_INSPECTION', icon: 'device' },
] as const;

/** Sample rates for development only (the prototype's numbers), never real market prices. */
export const SAMPLE_RATES: Record<string, number> = {
  IRON: 50,
  NEWSPAPER: 30,
  PLASTIC: 35,
  CARTON: 18,
  ALUMINIUM: 160,
};
