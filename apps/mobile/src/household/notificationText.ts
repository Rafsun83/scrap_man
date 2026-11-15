import { formatKg, formatTaka, t, type Lang } from '@bw/shared';
import type { Category, Notification } from '../api/types';
import { dhakaToday, formatDate } from '../lib/dhaka';
import { categoryNames } from '../lib/format';
import type { IconName } from '../ui/components';

export type NotificationView = {
  title: string;
  body: string;
  icon: IconName;
  tone: 'money' | 'ink' | 'alert';
  /** Where a tap goes. */
  href: string;
};

/** The API sends a type and facts; the app writes the sentence in the reader's language (H13). */
export function notificationView(
  n: Notification,
  lang: Lang,
  categories: Category[] | undefined,
  now: Date = new Date(),
): NotificationView {
  const d = n.data;
  const items = d.categoryCodes?.length ? categoryNames(categories, d.categoryCodes, lang) : '';
  const name = d.collectorName?.trim() || t('collectorFallbackName', lang);
  const amount = d.amount != null ? formatTaka(d.amount, lang) : '';
  const pickupHref = n.pickupId ? `/pickup/${n.pickupId}` : '/home';

  switch (n.type) {
    case 'PICKUP_ACCEPTED':
      return { title: t('n_PICKUP_ACCEPTED', lang, { name }), body: t('n_PICKUP_ACCEPTED_body', lang), icon: 'user-check', tone: 'ink', href: pickupHref };
    case 'PICKUP_RELEASED':
      return { title: t('n_PICKUP_RELEASED', lang), body: t('n_PICKUP_RELEASED_body', lang), icon: 'rotate-ccw', tone: 'ink', href: pickupHref };
    case 'PICKUP_WEIGHED':
      return {
        title: t((d.weighVersion ?? 1) > 1 ? 'n_PICKUP_REWEIGHED' : 'n_PICKUP_WEIGHED', lang, { amount }),
        body: t('n_PICKUP_WEIGHED_body', lang, { items, kg: d.totalKg != null ? formatKg(d.totalKg, lang) : '' }),
        icon: 'activity',
        tone: 'ink',
        href: pickupHref,
      };
    case 'PICKUP_PAID':
      return {
        title:
          d.method && d.method !== 'CASH'
            ? t('n_PICKUP_PAID_WALLET', lang, { amount, method: t(`pay_${d.method}`, lang) })
            : t('n_PICKUP_PAID_CASH', lang, { amount }),
        body: t('n_PICKUP_PAID_body', lang, { name, items }),
        icon: 'check-circle',
        tone: 'money',
        href: pickupHref,
      };
    case 'PICKUP_EXPIRED':
      return { title: t('n_PICKUP_EXPIRED', lang), body: t('n_PICKUP_EXPIRED_body', lang), icon: 'clock', tone: 'alert', href: '/sell/items' };
    case 'PICKUP_CANCELLED':
      return { title: t('n_PICKUP_CANCELLED', lang), body: t('n_PICKUP_CANCELLED_body', lang), icon: 'x-circle', tone: 'alert', href: pickupHref };
    case 'DISPUTE_RESOLVED':
      return {
        title: t('n_DISPUTE_RESOLVED', lang),
        body: d.outcome && d.outcome !== 'REWEIGHED' && d.outcome !== 'CANCEL' ? t(`outcome_${d.outcome}`, lang) : '',
        icon: 'shield',
        tone: 'ink',
        href: pickupHref,
      };
    case 'RATES_PUBLISHED':
      return {
        title:
          !d.effectiveDate || d.effectiveDate === dhakaToday(now)
            ? t('n_RATES_PUBLISHED', lang)
            : t('n_RATES_PUBLISHED_on', lang, { date: formatDate(d.effectiveDate, lang) }),
        body: t('n_RATES_PUBLISHED_body', lang),
        icon: 'trending-up',
        tone: 'money',
        href: '/rates',
      };
  }
}
