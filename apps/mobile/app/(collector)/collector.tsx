import { Redirect } from 'expo-router';
import { useCollectorProfile } from '../../src/collector/api';
import { collectorRoute } from '../../src/collector/collectorView';
import { useT } from '../../src/i18n/lang';
import { ErrorView, LoadingView } from '../../src/ui/components';
import { errorMessage } from '../../src/ui/errors';

/** Entry for collectors: sign-up (C6) until they apply, then waiting (C7), then the work tabs. */
export default function CollectorGate() {
  const { lang } = useT();
  const profile = useCollectorProfile();
  if (profile.isPending) return <LoadingView />;
  if (profile.isError) return <ErrorView message={errorMessage(profile.error, lang)} onRetry={() => profile.refetch()} />;
  const route = collectorRoute(profile.data);
  return <Redirect href={route === 'JOIN' ? '/join' : route === 'PENDING' ? '/pending' : '/requests'} />;
}
