import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ApiError, type ApiClient } from '../api/client';
import { keys, uploadPhoto, type LocalPhoto } from '../api/hooks';
import type { Pickup } from '../api/types';
import { useSession } from '../auth/session';
import type { DraftLine, WeightLine } from './weigh';

/**
 * A weigh round in progress, kept on the phone so a lost connection never loses the weights (product spec:
 * "the collector's weigh screen keeps a local draft and retries when the connection returns").
 */
export type WeighDraft = {
  pickupId: string;
  /** The weigh version this round will create; a draft for an older round is dropped. */
  round: number;
  lines: DraftLine[];
  /** Optional scale photo. */
  photo: LocalPhoto | null;
  /** Set once the scale photo is uploaded, so a retry does not upload it again. */
  photoId: string | null;
  /** Idempotency-Key for this round: a retry after a lost response is not weighed twice. */
  key: string;
  /** A send failed for lack of connection and will be retried. */
  queued: boolean;
};

export const RETRY_INTERVAL_MS = 15_000;
const storageKey = (pickupId: string) => `bw.weigh.${pickupId}`;

export async function loadDraft(pickupId: string, round: number): Promise<WeighDraft | null> {
  try {
    const raw = await SecureStore.getItemAsync(storageKey(pickupId));
    const draft = raw ? (JSON.parse(raw) as WeighDraft) : null;
    return draft && draft.round === round ? draft : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: WeighDraft): void {
  SecureStore.setItemAsync(storageKey(draft.pickupId), JSON.stringify(draft)).catch(() => {});
}

export function clearDraft(pickupId: string): void {
  SecureStore.deleteItemAsync(storageKey(pickupId)).catch(() => {});
}

export function newDraft(pickupId: string, round: number, lines: DraftLine[]): WeighDraft {
  return { pickupId, round, lines, photo: null, photoId: null, key: Crypto.randomUUID(), queued: false };
}

export type SendOutcome =
  | { kind: 'SENT'; pickup: Pickup }
  | { kind: 'QUEUED'; draft: WeighDraft }
  | { kind: 'FAILED'; draft: WeighDraft; error: unknown };

/** No answer from the API: worth retrying with the same key. */
export function isOffline(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'NETWORK' || error.status >= 500);
}

/**
 * The API answered but the photo did not reach storage (for example storage the phone cannot reach). Not a lost
 * connection, so it is not queued: the photo is dropped and the collector sends without it or takes a new one.
 */
export class PhotoUploadError extends Error {
  constructor(cause: unknown) {
    super(`Scale photo upload failed: ${String(cause)}`);
    this.name = 'PhotoUploadError';
  }
}

/** Uploads the photo; storage failures become PhotoUploadError, API failures stay ApiError. */
async function uploadScalePhoto(api: ApiClient, pickupId: string, photo: LocalPhoto): Promise<string> {
  try {
    return await uploadPhoto(api, `/pickups/${pickupId}/photos`, { kind: 'SCALE' }, photo);
  } catch (error) {
    throw error instanceof ApiError ? error : new PhotoUploadError(error);
  }
}

/**
 * Uploads the scale photo (once, when there is one) and sends the round. Offline failures keep the draft queued
 * for a retry; a photo that cannot be uploaded or is refused is dropped so the collector can send without it.
 */
export async function sendDraft(
  api: ApiClient,
  draft: WeighDraft,
  lines: WeightLine[],
  save: (d: WeighDraft) => void = saveDraft,
): Promise<SendOutcome> {
  let current = draft;
  try {
    if (current.photo && !current.photoId) {
      const photoId = await uploadScalePhoto(api, draft.pickupId, current.photo);
      current = { ...current, photoId };
      save(current);
    }
    const pickup = await api.request<Pickup>('POST', `/pickups/${draft.pickupId}/weights`, {
      body: { lines, ...(current.photoId ? { scalePhotoId: current.photoId } : {}) },
      idempotencyKey: current.key,
    });
    return { kind: 'SENT', pickup };
  } catch (error) {
    if (isOffline(error)) {
      current = { ...current, queued: true };
      save(current);
      return { kind: 'QUEUED', draft: current };
    }
    if (error instanceof PhotoUploadError || (error instanceof ApiError && error.code === 'SCALE_PHOTO_REQUIRED')) {
      current = { ...current, photo: null, photoId: null, key: Crypto.randomUUID(), queued: false };
    } else {
      current = { ...current, queued: false };
    }
    save(current);
    return { kind: 'FAILED', draft: current, error };
  }
}

/**
 * C4 and C10 state: the draft for this pickup's next round, edits saved as they happen, and sending with
 * automatic retries every 15 seconds and on return to the app while the send is queued.
 */
export function useWeighDraft(pickup: Pickup, initial: () => DraftLine[], toLines: (d: DraftLine[]) => WeightLine[] | null) {
  const { api } = useSession();
  const qc = useQueryClient();
  const round = (pickup.weighVersion ?? 0) + 1;
  const [draft, setDraft] = useState<WeighDraft | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    let alive = true;
    loadDraft(pickup.id, round).then((saved) => {
      if (alive) setDraft(saved ?? newDraft(pickup.id, round, initial()));
    });
    return () => {
      alive = false;
    };
    // Loaded once per pickup round: `initial` is only the starting point, not a dependency.
  }, [pickup.id, round]);

  const update = useCallback((change: (d: WeighDraft) => WeighDraft) => {
    setDraft((d) => {
      if (!d) return d;
      const next = change(d);
      saveDraft(next);
      return next;
    });
  }, []);

  const setLines = useCallback((lines: DraftLine[]) => update((d) => ({ ...d, lines })), [update]);
  // A new or removed photo is a new round body: new key, upload again.
  const setPhoto = useCallback(
    (photo: LocalPhoto | null) => {
      setError(null);
      update((d) => ({ ...d, photo, photoId: null, key: Crypto.randomUUID(), queued: false }));
    },
    [update],
  );

  const send = useCallback(async () => {
    if (!draft || sendingRef.current) return;
    const lines = toLines(draft.lines);
    if (!lines) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    const outcome = await sendDraft(api, draft, lines);
    sendingRef.current = false;
    setSending(false);
    if (outcome.kind === 'SENT') {
      clearDraft(pickup.id);
      qc.setQueryData(keys.pickup(pickup.id), outcome.pickup);
      qc.invalidateQueries({ queryKey: keys.allMyPickups });
      return;
    }
    setDraft(outcome.draft);
    if (outcome.kind === 'FAILED') setError(outcome.error);
  }, [api, draft, pickup.id, qc, toLines]);

  // Retry a queued send while the screen is open.
  const queued = draft?.queued === true;
  useEffect(() => {
    if (!queued) return;
    const timer = setInterval(() => void send(), RETRY_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void send());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [queued, send]);

  return { draft, setLines, setPhoto, send, sending, error };
}
