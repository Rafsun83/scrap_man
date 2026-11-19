import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import type { Pickup } from '../../api/types';
import { categories, makePickup, renderScreen } from '../../test/render';
import { ArriveView } from './ArriveView';
import { PayView } from './PayView';
import { WeighView } from './WeighView';

const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn(), dismissTo: jest.fn(), canGoBack: () => true };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('socket.io-client', () => ({ io: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'key-1' }));
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(async () => {}), getItemAsync: jest.fn(async () => null), deleteItemAsync: jest.fn(async () => {}) }));
const mockRequest = jest.fn();
jest.mock('../../auth/session', () => ({ useSession: () => ({ api: { request: mockRequest, refresh: jest.fn() } }) }));
jest.mock('../camera', () => ({ takePhoto: jest.fn(async () => ({ uri: 'file:///scale.jpg', mimeType: 'image/jpeg' })) }));

const accepted = makePickup({
  status: 'ACCEPTED',
  acceptedAt: '2026-11-14T03:10:00Z',
  household: { id: 'h1', name: 'রাশেদা বেগম', phone: '+8801712345456' },
  address: { text: 'বাড়ি ১২, রোড ৪, মিরপুর ১০', lat: 23.8, lng: 90.36, note: 'কেয়ারটেকারকে বলবেন' },
  lockedRates: [
    { categoryCode: 'IRON', rate: 50 },
    { categoryCode: 'NEWSPAPER', rate: 30 },
  ],
});

describe('C3 arrive and verify', () => {
  it('shows the address after accept and sends the 4-digit code (Bangla digits too)', async () => {
    const onArrive = jest.fn();
    await renderScreen(
      <ArriveView pickup={accepted} categories={categories} onArrive={onArrive} arriving={false} arriveError={null} onRelease={jest.fn()} releasing={false} releaseError={null} onNoShow={jest.fn()} noShowing={false} noShowError={null} />,
    );
    expect(screen.getByText('বাড়ি ১২, রোড ৪, মিরপুর ১০')).toBeTruthy();
    expect(screen.getByText('নোট: কেয়ারটেকারকে বলবেন')).toBeTruthy();
    expect(screen.getByTestId('verify-code').props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByTestId('code-input'), '৪৮২১');
    await fireEvent.press(screen.getByTestId('verify-code'));
    expect(onArrive).toHaveBeenCalledWith('4821');
  });

  it('opens directions and offers to give the request back', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const onRelease = jest.fn();
    await renderScreen(
      <ArriveView pickup={accepted} categories={categories} onArrive={jest.fn()} arriving={false} arriveError={null} onRelease={onRelease} releasing={false} releaseError={null} onNoShow={jest.fn()} noShowing={false} noShowError={null} />,
    );
    await fireEvent.press(screen.getByText('পথ দেখুন'));
    expect(open).toHaveBeenCalledWith(expect.stringContaining('destination=23.8,90.36'));
    await fireEvent.press(screen.getByText('গ্রাহককে পাওয়া যাচ্ছে না'));
    await fireEvent.press(screen.getByTestId('release-open'));
    await fireEvent.press(screen.getByTestId('release-confirm'));
    expect(onRelease).toHaveBeenCalledWith(undefined);
  });

  const noShowProps = () => ({
    categories,
    onArrive: jest.fn(),
    arriving: false,
    arriveError: null,
    onRelease: jest.fn(),
    releasing: false,
    releaseError: null,
    onNoShow: jest.fn(),
    noShowing: false,
    noShowError: null,
  });

  it('does not offer the nobody-home report before the booked slot starts', async () => {
    // The fixture's MORNING slot on 2026-11-14 starts at 09:00 Dhaka (03:00Z).
    await renderScreen(<ArriveView pickup={accepted} {...noShowProps()} now={new Date('2026-11-14T02:30:00Z')} />);
    await fireEvent.press(screen.getByText('গ্রাহককে পাওয়া যাচ্ছে না'));
    await fireEvent.press(screen.getByTestId('noshow-open'));
    expect(screen.getByText('বুক করা সময় সকাল ৯:০০-এ শুরু হবে। তার পরে জানাতে পারবেন।')).toBeTruthy();
    expect(screen.queryByTestId('noshow-confirm')).toBeNull();
  });

  it('reports nobody home with a note once the slot has started', async () => {
    const props = noShowProps();
    await renderScreen(<ArriveView pickup={accepted} {...props} now={new Date('2026-11-14T03:30:00Z')} />);
    await fireEvent.press(screen.getByText('গ্রাহককে পাওয়া যাচ্ছে না'));
    await fireEvent.press(screen.getByTestId('noshow-open'));
    await fireEvent.changeText(screen.getByLabelText('কী করেছেন (ঐচ্ছিক), যেমন দুবার কল করেছি'), 'দুবার কল করেছি');
    await fireEvent.press(screen.getByTestId('noshow-confirm'));
    expect(props.onNoShow).toHaveBeenCalledWith('দুবার কল করেছি');
  });

  it('shows the lock instead of the code entry after 5 wrong codes', async () => {
    await renderScreen(
      <ArriveView pickup={{ ...accepted, codeLocked: true }} categories={categories} onArrive={jest.fn()} arriving={false} arriveError={null} onRelease={jest.fn()} releasing={false} releaseError={null} onNoShow={jest.fn()} noShowing={false} noShowError={null} />,
    );
    expect(screen.queryByTestId('code-input')).toBeNull();
    expect(screen.getByText(/পিকআপটি আটকে গেছে/)).toBeTruthy();
  });
});

describe('C4 weigh', () => {
  const arrived = { ...accepted, status: 'ARRIVED' as const, arrivedAt: '2026-11-14T04:00:00Z' };
  const renderWeigh = (p: Pickup = arrived, mode: 'first' | 'reweigh' = 'first') =>
    renderScreen(
      <QueryClientProvider client={new QueryClient()}>
        <WeighView pickup={p} categories={categories} todayRates={[{ categoryCode: 'IRON', ratePerKg: 99 }]} mode={mode} />
      </QueryClientProvider>,
    );

  it('previews line amounts at the locked rate and needs a scale photo before sending', async () => {
    mockRequest.mockImplementation(async (method: string, path: string) =>
      path.endsWith('/photos') ? { photoId: 'photo-1', uploadUrl: 'https://s3/u', expiresAt: '' } : { ...arrived, status: 'WEIGHED' },
    );
    globalThis.fetch = jest.fn(async (url: string) => (url.startsWith('file:') ? { blob: async () => 'b' } : { ok: true })) as never;
    await renderWeigh();
    await waitFor(() => expect(screen.getByTestId('inc-IRON')).toBeTruthy());

    for (let i = 0; i < 3; i++) await fireEvent.press(screen.getByTestId('inc-IRON'));
    expect(screen.getByTestId('amount-IRON').props.children).toBe('৳৭৫');
    await fireEvent.changeText(screen.getByTestId('kg-NEWSPAPER'), '৫');
    expect(screen.getByTestId('preview-total').props.children).toBe('৳২২৫');
    expect(screen.getByTestId('send-weights').props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getByTestId('scale-photo'));
    await waitFor(() => expect(screen.getByTestId('send-weights').props.accessibilityState.disabled).toBe(false));
    await fireEvent.press(screen.getByTestId('send-weights'));
    await waitFor(() =>
      expect(mockRequest).toHaveBeenCalledWith('POST', '/pickups/p1/weights', {
        body: { lines: [{ categoryCode: 'IRON', kg: 1.5 }, { categoryCode: 'NEWSPAPER', kg: 5 }], scalePhotoId: 'photo-1' },
        idempotencyKey: 'key-1',
      }),
    );
  });

  it('shows the previous weights and the reason on a re-weigh', async () => {
    const disputed = {
      ...arrived,
      status: 'DISPUTED' as const,
      weighVersion: 1,
      lines: [{ categoryCode: 'IRON', kg: 9.5, rate: 50, amount: 475 }],
      openDispute: { id: 'd1', pickupId: 'p1', displayNo: 'BW-1052', type: 'WEIGHT' as const, status: 'REWEIGH' as const, raisedBy: 'h1', reason: 'লোহার ওজন কম', photoIds: [], outcome: null, resolutionNote: null, createdAt: '', resolvedAt: null },
    };
    await renderWeigh(disputed, 'reweigh');
    await waitFor(() => expect(screen.getByText('আবার ওজন করুন')).toBeTruthy());
    expect(screen.getByText('রাশেদা বেগম ওজনে আপত্তি করেছেন')).toBeTruthy();
    expect(screen.getByText('“লোহার ওজন কম”')).toBeTruthy();
    expect(screen.getByText('আগে: ৯.৫ কেজি')).toBeTruthy();
    expect(screen.getByText('এই ধাপে ছবি বাধ্যতামূলক')).toBeTruthy();
  });
});

describe('C5 pay', () => {
  const confirmed = makePickup({
    status: 'CONFIRMED',
    totalKg: 17.5,
    totalAmount: 710,
    lines: [{ categoryCode: 'IRON', kg: 17.5, rate: 40.57, amount: 710 }],
    paymentMethod: 'BKASH',
    walletNumber: '+8801712345456',
    household: { id: 'h1', name: 'রাশেদা বেগম', phone: '+8801712345456' },
  });

  it('needs a valid TrxID for bKash', async () => {
    const onPay = jest.fn();
    await renderScreen(<PayView pickup={confirmed} categories={categories} again={false} onPay={onPay} paying={false} error={null} />);
    expect(screen.getByTestId('pay-amount').props.children).toBe('৳৭১০');
    expect(screen.getByTestId('wallet').props.children).toBe('০১৭১২৩৪৫৪৫৬');
    expect(screen.getByTestId('paid').props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByTestId('trx-input'), 'abc');
    expect(screen.getByText('TrxID-তে ৬ থেকে ৩০টি ইংরেজি অক্ষর বা সংখ্যা থাকে।')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('trx-input'), '9kx7abc123');
    await fireEvent.press(screen.getByTestId('paid'));
    expect(onPay).toHaveBeenCalledWith({ method: 'BKASH', trxId: '9KX7ABC123' });
  });

  it('pays cash without a TrxID', async () => {
    const onPay = jest.fn();
    await renderScreen(
      <PayView pickup={{ ...confirmed, paymentMethod: 'CASH', walletNumber: null }} categories={categories} again={false} onPay={onPay} paying={false} error={null} />,
    );
    expect(screen.queryByTestId('trx-input')).toBeNull();
    await fireEvent.press(screen.getByTestId('paid'));
    expect(onPay).toHaveBeenCalledWith({ method: 'CASH' });
  });
});
