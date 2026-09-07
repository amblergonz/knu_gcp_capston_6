'use client';

import { useSyncExternalStore } from 'react';

// 장바구니는 모듈 싱글턴 + localStorage.
// 트래킹 레이어(2단계)가 여기의 mutate 훅에 add_to_cart / cart_change 를 붙인다.

export interface CartLine {
  hotel_id: string;
  hotel_name: string;
  room_id: string;
  room_name: string;
  price: number;
  qty: number;
  options: { id: string; label: string; price: number }[];
}

export interface CartState {
  lines: CartLine[];
  checkin: string;
  checkout: string;
  guests: number;
  coupon: string | null;
  couponPercent: number;
}

const KEY = 'hover_demo_cart';

function defaultDates() {
  const inDate = new Date();
  inDate.setDate(inDate.getDate() + 14);
  const outDate = new Date(inDate);
  outDate.setDate(outDate.getDate() + 2);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { checkin: iso(inDate), checkout: iso(outDate) };
}

const EMPTY: CartState = {
  lines: [],
  ...defaultDates(),
  guests: 2,
  coupon: null,
  couponPercent: 0,
};

let state: CartState = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

/** 장바구니가 바뀔 때마다 트래커가 구독한다. reason 은 cart_change 페이로드에 실린다. */
export type CartChangeReason = 'add' | 'remove' | 'qty' | 'clear' | 'options' | 'resync';
type MutationHook = (next: CartState, reason: CartChangeReason, line?: CartLine) => void;
let mutationHook: MutationHook | null = null;

export function setCartMutationHook(hook: MutationHook | null) {
  mutationHook = hook;
}

function emit() {
  for (const l of listeners) l();
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* 프라이빗 모드 등에서 실패해도 데모는 계속 돈다 */
  }
}

function commit(next: CartState, reason: CartChangeReason, line?: CartLine) {
  state = next;
  persist();
  emit();
  mutationHook?.(state, reason, line);
}

export function hydrateCart() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CartState;
      if (parsed && Array.isArray(parsed.lines)) {
        state = { ...EMPTY, ...parsed };
        emit();
      }
    }
  } catch {
    /* 손상된 값이면 빈 장바구니로 시작 */
  }
}

export function subscribeCart(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getCart(): CartState {
  return state;
}

function getServerCart(): CartState {
  return EMPTY;
}

export function cartCount(s: CartState = state): number {
  return s.lines.reduce((n, l) => n + l.qty, 0);
}

export function cartTotal(s: CartState = state, nights = 1): number {
  const rooms = s.lines.reduce((sum, l) => {
    const opts = l.options.reduce((o, x) => o + x.price, 0);
    return sum + (l.price * nights + opts) * l.qty;
  }, 0);
  return rooms;
}

export function addRoom(line: Omit<CartLine, 'qty'>, qty = 1) {
  const lines = state.lines.slice();
  const i = lines.findIndex((l) => l.room_id === line.room_id);
  if (i >= 0) lines[i] = { ...lines[i], qty: lines[i].qty + qty };
  else lines.push({ ...line, qty });
  commit({ ...state, lines }, 'add', { ...line, qty });
}

export function setQty(roomId: string, qty: number) {
  const lines = state.lines
    .map((l) => (l.room_id === roomId ? { ...l, qty: Math.max(0, qty) } : l))
    .filter((l) => l.qty > 0);
  const removed = qty <= 0;
  commit({ ...state, lines }, removed ? 'remove' : 'qty');
}

export function removeRoom(roomId: string) {
  commit({ ...state, lines: state.lines.filter((l) => l.room_id !== roomId) }, 'remove');
}

export function clearCart() {
  commit({ ...state, lines: [], coupon: null, couponPercent: 0 }, 'clear');
}

export function setStay(patch: Partial<Pick<CartState, 'checkin' | 'checkout' | 'guests'>>) {
  state = { ...state, ...patch };
  persist();
  emit();
}

export function applyCoupon(code: string, percent: number) {
  state = { ...state, coupon: code, couponPercent: percent };
  persist();
  emit();
}

export function clearCoupon() {
  state = { ...state, coupon: null, couponPercent: 0 };
  persist();
  emit();
}

export function useCart(): CartState {
  return useSyncExternalStore(subscribeCart, getCart, getServerCart);
}
