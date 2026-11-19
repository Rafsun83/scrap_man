import { NotificationsScreen } from '../../src/notifications/NotificationsScreen';

/** The collector's notifications (bell on C1). Its own path: /notifications belongs to the household app. */
export default function Inbox() {
  return <NotificationsScreen role="COLLECTOR" />;
}
