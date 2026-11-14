import type { WeightBand } from '@bw/shared';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type DraftPhoto = { uri: string; mimeType?: string | null };

export type SellDraft = {
  categoryCodes: string[];
  weightBand: WeightBand;
  photo: DraftPhoto | null;
};

const EMPTY: SellDraft = { categoryCodes: [], weightBand: 'FROM_5_TO_15', photo: null };

type Value = { draft: SellDraft; update: (patch: Partial<SellDraft>) => void; clear: () => void };

const DraftContext = createContext<Value | null>(null);

/** Carries H3's choices (items, weight band, photo) to H4 until the request is sent. */
export function SellDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<SellDraft>(EMPTY);
  const value = useMemo<Value>(
    () => ({
      draft,
      update: (patch) => setDraft((d) => ({ ...d, ...patch })),
      clear: () => setDraft(EMPTY),
    }),
    [draft],
  );
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useSellDraft(): Value {
  const v = useContext(DraftContext);
  if (!v) throw new Error('useSellDraft must be used inside SellDraftProvider');
  return v;
}
