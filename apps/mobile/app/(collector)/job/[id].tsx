import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError } from '../../../src/api/client';
import { useCategories, useIdempotencyKey, usePickup, useTodayRates } from '../../../src/api/hooks';
import { useArrive, useNoShow, useRecordPayment, useRelease } from '../../../src/collector/api';
import { jobScreenFor } from '../../../src/collector/collectorView';
import { ArriveView } from '../../../src/collector/job/ArriveView';
import { PayView, type PayBody } from '../../../src/collector/job/PayView';
import { DoneView, EndedView, ReviewView, WaitConfirmView } from '../../../src/collector/job/StatusViews';
import { WeighView } from '../../../src/collector/job/WeighView';
import { useT } from '../../../src/i18n/lang';
import { ErrorView, LoadingView } from '../../../src/ui/components';
import { errorMessage } from '../../../src/ui/errors';

/** One route for an assigned pickup; the status picks the screen (C3, C4, C10, C5, waiting, done). Live events refetch it. */
export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { lang } = useT();
  const router = useRouter();
  const pickup = usePickup(id);
  const categories = useCategories();
  const rates = useTodayRates();
  const arrive = useArrive(id);
  const release = useRelease(id);
  const noShow = useNoShow(id);
  const pay = useRecordPayment(id);
  const idem = useIdempotencyKey();

  if (pickup.isPending) return <LoadingView />;
  // Given back, or reassigned: the API no longer shows it to this collector.
  if (pickup.isError && pickup.error instanceof ApiError && pickup.error.code === 'NOT_FOUND') return <EndedView />;
  if (pickup.isError) return <ErrorView message={errorMessage(pickup.error, lang)} onRetry={() => pickup.refetch()} />;

  const p = pickup.data;
  const cats = categories.data;
  const onPay = (body: PayBody) => pay.mutate({ body, key: idem.keyFor(body) });

  switch (jobScreenFor(p)) {
    case 'ARRIVE':
      return (
        <ArriveView
          pickup={p}
          categories={cats}
          onArrive={(code) => arrive.mutate(code, { onError: () => void pickup.refetch() })}
          arriving={arrive.isPending}
          arriveError={arrive.error ? errorMessage(arrive.error, lang) : null}
          onRelease={(reason) => release.mutate(reason, { onSuccess: () => router.dismissTo('/requests') })}
          releasing={release.isPending}
          releaseError={release.error ? errorMessage(release.error, lang) : null}
          onNoShow={(note) => noShow.mutate(note)}
          noShowing={noShow.isPending}
          noShowError={noShow.error ? errorMessage(noShow.error, lang) : null}
        />
      );
    case 'WEIGH':
      return <WeighView pickup={p} categories={cats} todayRates={rates.data?.rates} mode="first" />;
    case 'REWEIGH':
      return <WeighView pickup={p} categories={cats} todayRates={rates.data?.rates} mode="reweigh" />;
    case 'WAIT_CONFIRM':
      return <WaitConfirmView pickup={p} categories={cats} />;
    case 'REVIEW':
      return <ReviewView />;
    case 'PAY':
    case 'PAY_AGAIN':
      return (
        <PayView
          pickup={p}
          categories={cats}
          again={jobScreenFor(p) === 'PAY_AGAIN'}
          onPay={onPay}
          paying={pay.isPending}
          error={pay.error ? errorMessage(pay.error, lang) : null}
        />
      );
    case 'DONE':
      return <DoneView pickup={p} />;
    case 'ENDED':
      return <EndedView />;
  }
}
