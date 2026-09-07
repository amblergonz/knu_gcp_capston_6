'use client';

import { useSyncExternalStore } from 'react';

const KEY = 'hover_demo_wishlist';

let ids: string[] = [];
const EMPTY: string[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

type WishHook = (hotelId: string, action: 'add' | 'remove', size: number) => void;
let hook: WishHook | null = null;

export function setWishlistHook(h: WishHook | null) {
  hook = h;
}

function emit() {
  for (const l of listeners) l();
}

export function hydrateWishlist() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        ids = parsed.filter((x) => typeof x === 'string');
        emit();
      }
    }
  } catch {
    /* noop */
  }
}

export function subscribeWishlist(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getWishlist(): string[] {
  return ids;
}

function getServerWishlist(): string[] {
  return EMPTY;
}

export function toggleWishlist(hotelId: string) {
  const has = ids.includes(hotelId);
  ids = has ? ids.filter((x) => x !== hotelId) : ids.concat(hotelId);
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* noop */
  }
  emit();
  hook?.(hotelId, has ? 'remove' : 'add', ids.length);
}

export function useWishlist(): string[] {
  return useSyncExternalStore(subscribeWishlist, getWishlist, getServerWishlist);
}
