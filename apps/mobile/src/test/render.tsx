import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Pickup } from '../api/types';
import { LangProvider } from '../i18n/lang';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function wrap(ui: ReactElement, lang: 'bn' | 'en') {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <LangProvider initial={lang}>{ui}</LangProvider>
    </SafeAreaProvider>
  );
}

/** Renders with the providers every screen needs (Bangla unless `lang: 'en'`); rerender keeps them. */
export async function renderScreen(ui: ReactElement, lang: 'bn' | 'en' = 'bn') {
  const result = await render(wrap(ui, lang));
  return { ...result, rerender: (next: ReactElement) => result.rerender(wrap(next, lang)) };
}

export const categories = [
  { code: 'IRON', nameBn: 'লোহা', nameEn: 'Iron', pricingType: 'PER_KG' as const, icon: 'iron' },
  { code: 'NEWSPAPER', nameBn: 'পুরোনো পত্রিকা', nameEn: 'Old newspaper', pricingType: 'PER_KG' as const, icon: 'newspaper' },
  { code: 'ELECTRONICS', nameBn: 'ইলেকট্রনিক্স', nameEn: 'Electronics', pricingType: 'ON_INSPECTION' as const, icon: 'device' },
];

/** A pickup in the given status with the fields the household screens read. */
export function makePickup(overrides: Partial<Pickup> = {}): Pickup {
  return {
    id: 'p1',
    displayNo: 'BW-1052',
    status: 'REQUESTED',
    slotDate: '2026-11-14',
    slot: 'MORNING',
    weightBand: 'FROM_5_TO_15',
    categoryCodes: ['IRON', 'NEWSPAPER'],
    area: 'Mirpur 10',
    estimate: { min: 190, max: 580 },
    address: { text: 'House 12, Road 4, Mirpur 10', lat: 23.8069, lng: 90.3687, note: null },
    household: { id: 'h1', name: 'Rasheda', phone: null },
    collector: null,
    pickupCode: null,
    codeLocked: false,
    lines: [],
    weighVersion: null,
    weighRounds: [],
    photos: [],
    totalKg: null,
    totalAmount: null,
    paymentMethod: null,
    walletNumber: null,
    payment: null,
    openDispute: null,
    searchRadiusM: 1000,
    requestedAt: '2026-11-14T03:00:00Z',
    acceptedAt: null,
    arrivedAt: null,
    weighedAt: null,
    confirmedAt: null,
    completedAt: null,
    cancelledAt: null,
    expiresAt: '2026-11-14T06:00:00Z',
    collectorLocation: null,
    rating: null,
    ...overrides,
  };
}

export const weighed = {
  status: 'WEIGHED' as const,
  acceptedAt: '2026-11-14T03:10:00Z',
  collector: { id: 'c1', name: 'জসিম উদ্দিন', rating: 4.6, phone: '+8801811111111' },
  lines: [
    { categoryCode: 'IRON', kg: 8.5, rate: 50, amount: 425 },
    { categoryCode: 'NEWSPAPER', kg: 6, rate: 30, amount: 180 },
  ],
  weighVersion: 1,
  totalKg: 14.5,
  totalAmount: 605,
  photos: [{ id: 's1', kind: 'SCALE' as const, weighVersion: 1, url: 'https://s3/scale.jpg', createdAt: '' }],
};
