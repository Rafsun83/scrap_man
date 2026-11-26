import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen } from '@testing-library/react-native';
import LedgerScreen from '../../app/(collector)/(work)/ledger';
import { categories, renderScreen } from '../test/render';

jest.mock('socket.io-client', () => ({ io: jest.fn() }));
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(async () => {}), getItemAsync: jest.fn(async () => null), deleteItemAsync: jest.fn(async () => {}) }));
const mockRequest = jest.fn();
jest.mock('../auth/session', () => ({ useSession: () => ({ api: { request: mockRequest, refresh: jest.fn() } }) }));

const payments = Array.from({ length: 45 }, (_, i) => ({
  pickupId: `p${i}`,
  householdName: `Customer ${i}`,
  method: 'CASH' as const,
  trxId: null,
  amount: 100,
  paidAt: '2026-11-20T05:00:00Z',
}));

function setup() {
  mockRequest.mockImplementation(async (_method: string, path: string) => {
    if (path === '/categories') return categories;
    return {
      from: '2026-11-01',
      to: '2026-11-26',
      totalPaid: 4500,
      totalKg: 90,
      pickupCount: 45,
      byMethod: { CASH: 4500, BKASH: 0, NAGAD: 0 },
      byCategory: [{ categoryCode: 'IRON', kg: 90 }],
      payments,
    };
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderScreen(
    <QueryClientProvider client={client}>
      <LedgerScreen />
    </QueryClientProvider>,
    'en',
  );
}

describe('C9 ledger', () => {
  it('draws payments 20 at a time, with the date outside "today"', async () => {
    await setup();
    expect(await screen.findByTestId('payment-p0')).toBeTruthy();
    expect(screen.queryByTestId('payment-p19')).toBeTruthy();
    expect(screen.queryByTestId('payment-p20')).toBeNull();
    // Today shows the time only.
    expect(screen.getAllByText('11:00 am, Cash in hand').length).toBe(20);

    await fireEvent.press(screen.getByTestId('ledger-more'));
    expect(screen.getByTestId('payment-p39')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('ledger-more'));
    expect(screen.getByTestId('payment-p44')).toBeTruthy();
    expect(screen.queryByTestId('ledger-more')).toBeNull();

    // Week and month add the date, and start again from the first page.
    await fireEvent.press(screen.getByText('This month'));
    expect((await screen.findAllByText(/^20 Nov\w*( 2026)?, 11:00 am, Cash in hand$/)).length).toBe(20);
    expect(screen.queryByTestId('payment-p20')).toBeNull();
  });
});
