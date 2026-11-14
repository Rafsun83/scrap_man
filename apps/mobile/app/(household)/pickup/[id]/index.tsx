import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useCancelPickup,
  useCategories,
  useConfirmPickup,
  useIdempotencyKey,
  usePickup,
  useRateCollector,
} from '../../../../src/api/hooks';
import { useSession } from '../../../../src/auth/session';
import { ConfirmView, type ConfirmBody } from '../../../../src/household/pickup/ConfirmView';
import { DisputedView, EndedView, PaymentWaitView, ReceiptView } from '../../../../src/household/pickup/OtherViews';
import { SearchingView } from '../../../../src/household/pickup/SearchingView';
import { TrackingView } from '../../../../src/household/pickup/TrackingView';
import { useT } from '../../../../src/i18n/lang';
import { screenFor } from '../../../../src/lib/pickupView';
import { ErrorView, LoadingView } from '../../../../src/ui/components';
import { errorMessage } from '../../../../src/ui/errors';

/** One route for a pickup; the status picks the screen (H5, H6, H7, disputed, H8, ended). Live events refetch it. */
export default function PickupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useT();
  const router = useRouter();
  const { user } = useSession();
  const pickup = usePickup(id);
  const categories = useCategories();
  const cancel = useCancelPickup(id);
  const confirm = useConfirmPickup(id);
  const rate = useRateCollector(id);
  const idem = useIdempotencyKey();

  if (pickup.isPending) return <LoadingView />;
  if (pickup.isError) return <ErrorView message={errorMessage(pickup.error, lang)} onRetry={() => pickup.refetch()} />;

  const p = pickup.data;
  const cats = categories.data;
  const report = (type?: string) => router.push({ pathname: '/pickup/[id]/report', params: { id, ...(type ? { type } : {}) } });

  switch (screenFor(p.status)) {
    case 'SEARCHING':
      return (
        <SearchingView
          pickup={p}
          categories={cats}
          onCancel={() => cancel.mutate(undefined)}
          cancelling={cancel.isPending}
          cancelError={cancel.error ? errorMessage(cancel.error, lang) : null}
        />
      );
    case 'TRACKING':
      return <TrackingView pickup={p} />;
    case 'CONFIRM':
      return (
        <ConfirmView
          pickup={p}
          categories={cats}
          userPhone={user?.phone}
          confirming={confirm.isPending}
          error={confirm.error ? errorMessage(confirm.error, lang) : null}
          onReport={() => report('WEIGHT')}
          onConfirm={(body: ConfirmBody) => confirm.mutate({ body, key: idem.keyFor(body) })}
        />
      );
    case 'DISPUTED':
      return <DisputedView pickup={p} categories={cats} />;
    case 'PAYMENT':
      return <PaymentWaitView pickup={p} categories={cats} />;
    case 'RECEIPT':
      return (
        <ReceiptView
          pickup={p}
          categories={cats}
          onRate={async (stars) => {
            await rate.mutateAsync({ stars });
          }}
          onReportPayment={() => report('PAYMENT')}
        />
      );
    case 'ENDED':
      return <EndedView pickup={p} categories={cats} />;
  }
  return <ErrorView message={t('errGeneric')} />;
}
