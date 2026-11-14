import { Redirect } from 'expo-router';

/** The Sell tab never shows itself: pressing it opens /sell/items (see the tab layout). */
export default function SellTab() {
  return <Redirect href="/sell/items" />;
}
