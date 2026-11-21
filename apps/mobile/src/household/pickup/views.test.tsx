import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ApiError } from '../../api/client';
import { setCollectorLocation } from '../../realtime/socket';
import { categories, makePickup, renderScreen, weighed } from '../../test/render';
import { ConfirmView } from './ConfirmView';
import { EndedView, ReceiptView } from './OtherViews';
import { SearchingView } from './SearchingView';
import { TrackingView } from './TrackingView';

const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn(), dismissTo: jest.fn(), canGoBack: () => true };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
const router = mockRouter;
jest.mock('socket.io-client', () => ({ io: jest.fn() }));

describe('H5 searching', () => {
  it('shows the request and asks before cancelling', async () => {
    const onCancel = jest.fn();
    const alert = jest.spyOn(Alert, 'alert');
    await renderScreen(<SearchingView pickup={makePickup()} categories={categories} onCancel={onCancel} cancelling={false} cancelError={null} />);
    expect(screen.getByText('কাছের সংগ্রাহক খোঁজা হচ্ছে')).toBeTruthy();
    expect(screen.getByText('লোহা, পুরোনো পত্রিকা')).toBeTruthy();
    expect(screen.getByText('১.০ কিমির মধ্যে খোঁজা হচ্ছে')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('cancel-request'));
    const buttons = alert.mock.calls[0][2]!;
    buttons.find((b) => b.style === 'destructive')!.onPress!();
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows online collectors on the radar and how many there are', async () => {
    const nearby = {
      radiusM: 3000,
      count: 2,
      collectors: [
        { distanceM: 400, bearingDeg: 0 },
        { distanceM: 2100, bearingDeg: 120 },
      ],
    };
    await renderScreen(
      <SearchingView pickup={makePickup()} categories={categories} nearby={nearby} onCancel={jest.fn()} cancelling={false} cancelError={null} />,
    );
    expect(screen.getAllByTestId('radar-collector', { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.getByText('কাছে ২ জন সংগ্রাহক অনলাইনে আছেন')).toBeTruthy();
    // the radar's radius is newer than the pickup's after widening
    expect(screen.getByText('৩.০ কিমির মধ্যে খোঁজা হচ্ছে')).toBeTruthy();
  });

  it('says so when nobody is online nearby', async () => {
    await renderScreen(
      <SearchingView
        pickup={makePickup()}
        categories={categories}
        nearby={{ radiusM: 1000, count: 0, collectors: [] }}
        onCancel={jest.fn()}
        cancelling={false}
        cancelError={null}
      />,
    );
    expect(screen.queryAllByTestId('radar-collector', { includeHiddenElements: true })).toHaveLength(0);
    expect(screen.getByText(/এই মুহূর্তে কাছে কেউ অনলাইনে নেই/)).toBeTruthy();
  });
});

describe('H6 tracking', () => {
  const accepted = makePickup({
    status: 'ACCEPTED',
    acceptedAt: '2026-11-14T03:10:00Z',
    collector: weighed.collector,
    pickupCode: '4821',
  });

  it('shows the pickup code in Bangla digits while ACCEPTED', async () => {
    await renderScreen(<TrackingView pickup={accepted} />);
    expect(screen.getByText('জসিম আসছেন')).toBeTruthy();
    expect(screen.getByTestId('pickup-code').props.children).toBe('৪৮২১');
    expect(screen.getByText('কল করুন')).toBeTruthy();
  });

  it('shows distance and ETA once the collector moves', async () => {
    setCollectorLocation('p1', { lat: 23.7957, lng: 90.3537, at: '' });
    await renderScreen(<TrackingView pickup={accepted} />);
    expect(screen.getByText('২.০ কিমি দূরে')).toBeTruthy();
    expect(screen.getByText(/প্রায় .* মিনিট/)).toBeTruthy();
  });

  it('starts from the saved collector location before any live event', async () => {
    await renderScreen(<TrackingView pickup={{ ...accepted, id: 'p-saved', collectorLocation: { lat: 23.7957, lng: 90.3537, at: '2026-11-14T03:15:00Z' } }} />);
    expect(screen.getByText('২.০ কিমি দূরে')).toBeTruthy();
  });

  it('prefers a newer live position over the saved one', async () => {
    setCollectorLocation('p-live', { lat: 23.8069, lng: 90.3687, at: '2026-11-14T03:20:00Z' });
    await renderScreen(<TrackingView pickup={{ ...accepted, id: 'p-live', collectorLocation: { lat: 23.7957, lng: 90.3537, at: '2026-11-14T03:15:00Z' } }} />);
    expect(screen.getByText('০.০ কিমি দূরে')).toBeTruthy();
  });

  it('hides the code after arrival and warns when it is locked', async () => {
    const { rerender } = await renderScreen(<TrackingView pickup={{ ...accepted, status: 'ARRIVED', pickupCode: null }} />);
    expect(screen.queryByTestId('pickup-code')).toBeNull();
    expect(screen.getByText('জসিম পৌঁছেছেন')).toBeTruthy();
    await rerender(<TrackingView pickup={{ ...accepted, codeLocked: true }} />);
    expect(screen.getByText(/পিকআপটি আটকে গেছে/)).toBeTruthy();
  });
});

describe('H7 confirm weight', () => {
  const pickup = makePickup(weighed);

  it('shows the server totals and lines', async () => {
    await renderScreen(<ConfirmView pickup={pickup} categories={categories} userPhone="+8801712345456" onConfirm={jest.fn()} onReport={jest.fn()} confirming={false} error={null} />);
    expect(screen.getByTestId('total-amount').props.children).toBe('৳৬০৫');
    expect(screen.getByText('৮.৫ কেজি × ৳৫০')).toBeTruthy();
    expect(screen.getByText('পাল্লার ছবি দেখুন')).toBeTruthy();
  });

  it('confirms cash without a wallet number', async () => {
    const onConfirm = jest.fn();
    await renderScreen(<ConfirmView pickup={pickup} categories={categories} userPhone={undefined} onConfirm={onConfirm} onReport={jest.fn()} confirming={false} error={null} />);
    await fireEvent.press(screen.getByTestId('confirm-weights'));
    expect(onConfirm).toHaveBeenCalledWith({ paymentMethod: 'CASH' });
  });

  it('sends bKash with the wallet number in API form, and blocks an invalid number', async () => {
    const onConfirm = jest.fn();
    await renderScreen(<ConfirmView pickup={pickup} categories={categories} userPhone="+8801712345456" onConfirm={onConfirm} onReport={jest.fn()} confirming={false} error={null} />);
    await fireEvent.press(screen.getByTestId('pay-BKASH'));
    await fireEvent.press(screen.getByTestId('confirm-weights'));
    expect(onConfirm).toHaveBeenLastCalledWith({ paymentMethod: 'BKASH', walletNumber: '+8801712345456' });

    await fireEvent.changeText(screen.getByTestId('wallet-input'), '0171');
    expect(screen.getByText('সঠিক বিকাশ নম্বর লিখুন।')).toBeTruthy();
    onConfirm.mockClear();
    await fireEvent.press(screen.getByTestId('confirm-weights'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('offers "problem with weights" only without an open dispute', async () => {
    const onReport = jest.fn();
    const { rerender } = await renderScreen(<ConfirmView pickup={pickup} categories={categories} userPhone={undefined} onConfirm={jest.fn()} onReport={onReport} confirming={false} error={null} />);
    await fireEvent.press(screen.getByTestId('weight-problem'));
    expect(onReport).toHaveBeenCalled();
    await rerender(<ConfirmView pickup={{ ...pickup, openDispute: { id: 'd1' } as never }} categories={categories} userPhone={undefined} onConfirm={jest.fn()} onReport={onReport} confirming={false} error={null} />);
    expect(screen.queryByTestId('weight-problem')).toBeNull();
  });

  it('shows English when English is chosen', async () => {
    await renderScreen(<ConfirmView pickup={pickup} categories={categories} userPhone={undefined} onConfirm={jest.fn()} onReport={jest.fn()} confirming={false} error={null} />, 'en');
    expect(screen.getByText('Check the weights')).toBeTruthy();
    expect(screen.getByTestId('total-amount').props.children).toBe('৳605');
  });
});

describe('H8 receipt', () => {
  const completed = makePickup({
    ...weighed,
    status: 'COMPLETED',
    completedAt: '2026-11-14T04:20:00Z',
    paymentMethod: 'BKASH',
    payment: { method: 'BKASH', amount: 605, walletNumber: '+8801712345456', trxId: 'TRX12345', status: 'PAID', paidAt: '2026-11-14T04:20:00Z' },
  });

  it('shows the amount, wallet and receipt', async () => {
    await renderScreen(<ReceiptView pickup={completed} categories={categories} onRate={jest.fn()} onReportPayment={jest.fn()} />);
    expect(screen.getByTestId('received').props.children).toBe('৳৬০৫ পেয়েছেন');
    expect(screen.getByText('বিকাশ-এ পাঠানো হয়েছে: ০১৭১২৩৪৫৪৫৬')).toBeTruthy();
    expect(screen.getByText('টাকা পাননি? জানান')).toBeTruthy();
  });

  it('saves a rating once', async () => {
    const onRate = jest.fn().mockResolvedValue(undefined);
    await renderScreen(<ReceiptView pickup={completed} categories={categories} onRate={onRate} onReportPayment={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('star-4'));
    await waitFor(() => expect(screen.getByText('ধন্যবাদ! আপনার রেটিং জমা হয়েছে।')).toBeTruthy());
    expect(onRate).toHaveBeenCalledWith(4);
  });

  it('shows a saved rating without asking again', async () => {
    const onRate = jest.fn();
    await renderScreen(<ReceiptView pickup={{ ...completed, rating: { stars: 4, comment: null, createdAt: '' } }} categories={categories} onRate={onRate} onReportPayment={jest.fn()} />);
    expect(screen.getByText('আপনি ৪ স্টার দিয়েছেন। ধন্যবাদ!')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('star-5'));
    expect(onRate).not.toHaveBeenCalled();
  });

  it('says so when the pickup was already rated', async () => {
    const onRate = jest.fn().mockRejectedValue(new ApiError('INVALID_STATE', 'You already rated this pickup.', 409));
    await renderScreen(<ReceiptView pickup={completed} categories={categories} onRate={onRate} onReportPayment={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('star-5'));
    await waitFor(() => expect(screen.getByText('এই পিকআপে আগেই রেটিং দিয়েছেন।')).toBeTruthy());
  });
});

it('offers to send an expired request again', async () => {
  await renderScreen(<EndedView pickup={makePickup({ status: 'EXPIRED' })} categories={categories} />);
  expect(screen.getByText('অনুরোধের সময় শেষ হয়েছে')).toBeTruthy();
  await fireEvent.press(screen.getByText('আবার অনুরোধ পাঠান'));
  expect(router.push).toHaveBeenCalledWith('/sell/items');
});
