/**
 * Shared cart utilities — used by both Shop and ProductDetail.
 *
 * Keeping this in one place means the storage key, serialisation format,
 * and hydration logic are always in sync between the two components.
 */

import type { ShopItem } from './types';

export interface CartEntry {
  item:     ShopItem;
  quantity: number;
}

export interface PersistedEntry {
  id:       string;
  quantity: number;
}

export const CART_STORAGE_KEY = 'hf-shop-cart';

export function loadCart(items: ShopItem[]): CartEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const persisted: PersistedEntry[] = JSON.parse(raw);
    return persisted.flatMap(({ id, quantity }) => {
      const item = items.find(i => i.id === id);
      if (!item || quantity < 1) return [];
      return [{ item, quantity: Math.min(quantity, item.maxQuantity ?? 99) }];
    });
  } catch {
    return [];
  }
}

/** Load raw persisted entries without needing the full items catalogue.
 *  Used by ProductDetail which only knows about one item. */
export function loadRawCart(): PersistedEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCart(entries: PersistedEntry[]): void {
  try {
    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

export function clearCart(): void {
  try {
    sessionStorage.removeItem(CART_STORAGE_KEY);
  } catch {}
}

/** Add one unit of an item, respecting maxQuantity. Returns new persisted array. */
export function cartAdd(current: PersistedEntry[], item: ShopItem): PersistedEntry[] {
  const max = item.maxQuantity ?? 99;
  const existing = current.find(e => e.id === item.id);
  if (existing) {
    if (existing.quantity >= max) return current;
    return current.map(e =>
      e.id === item.id ? { ...e, quantity: e.quantity + 1 } : e
    );
  }
  return [...current, { id: item.id, quantity: 1 }];
}

export function cartUpdate(current: PersistedEntry[], id: string, delta: number): PersistedEntry[] {
  return current
    .map(e => e.id === id ? { ...e, quantity: e.quantity + delta } : e)
    .filter(e => e.quantity > 0);
}

export function cartRemove(current: PersistedEntry[], id: string): PersistedEntry[] {
  return current.filter(e => e.id !== id);
}

export function cartTotalItems(current: PersistedEntry[]): number {
  return current.reduce((n, e) => n + e.quantity, 0);
}

export function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style:    'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}