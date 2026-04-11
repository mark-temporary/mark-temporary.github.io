/**
 * Shared cart utilities — used by StripeShop, ProductDetail, and CartWidget.
 *
 * Storage format: the full ShopItem is stored alongside the quantity so that
 * CartWidget (which has no access to the product catalogue) can render a rich
 * drawer with names, images, prices and a total — exactly like the in-page
 * StripeShop drawer.
 */

import type { ShopItem } from './types';

export interface CartEntry {
  item:     ShopItem;
  quantity: number;
}

/** What we write to sessionStorage — full item data, not just an id. */
export interface PersistedEntry {
  item:     ShopItem;
  quantity: number;
}

export const CART_STORAGE_KEY = 'hf-shop-cart';

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export function loadCart(): CartEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const persisted: PersistedEntry[] = JSON.parse(raw);
    return persisted
      .filter(e => e.item?.id && e.quantity > 0)
      .map(e => ({ item: e.item, quantity: e.quantity }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export function saveCart(entries: CartEntry[]): void {
  try {
    const persisted: PersistedEntry[] = entries.map(({ item, quantity }) => ({ item, quantity }));
    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(persisted));
    // Notify same-tab listeners (e.g. CartWidget in the Navbar).
    // The native 'storage' event only fires in OTHER tabs.
    window.dispatchEvent(new CustomEvent('hf-cart-updated'));
  } catch {}
}

export function clearCart(): void {
  try {
    sessionStorage.removeItem(CART_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('hf-cart-updated'));
  } catch {}
}

// ---------------------------------------------------------------------------
// Country persistence
// ---------------------------------------------------------------------------

const COUNTRY_STORAGE_KEY = 'hf-shop-country';

export function loadCountry(): string {
  try {
    return sessionStorage.getItem(COUNTRY_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveCountry(code: string): void {
  try {
    sessionStorage.setItem(COUNTRY_STORAGE_KEY, code);
  } catch {}
}

// ---------------------------------------------------------------------------
// Mutations — all return a new CartEntry[] (never mutate in place)
// ---------------------------------------------------------------------------

export function cartAdd(current: CartEntry[], item: ShopItem): CartEntry[] {
  const max = item.maxQuantity ?? 99;
  const existing = current.find(e => e.item.id === item.id);
  if (existing) {
    if (existing.quantity >= max) return current;
    return current.map(e =>
      e.item.id === item.id ? { ...e, quantity: e.quantity + 1 } : e
    );
  }
  return [...current, { item, quantity: 1 }];
}

export function cartUpdate(current: CartEntry[], id: string, delta: number): CartEntry[] {
  return current
    .map(e => {
      if (e.item.id !== id) return e;
      const max = e.item.maxQuantity ?? 99;
      const next = Math.min(e.quantity + delta, max);
      return { ...e, quantity: next };
    })
    .filter(e => e.quantity > 0);
}

export function cartRemove(current: CartEntry[], id: string): CartEntry[] {
  return current.filter(e => e.item.id !== id);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function cartTotalItems(current: CartEntry[]): number {
  return current.reduce((n, e) => n + e.quantity, 0);
}

export function cartTotalPrice(current: CartEntry[], defaultCurrency: string): string {
  if (current.length === 0) return '';
  const currency = (current[0].item.currency ?? defaultCurrency).toUpperCase();
  const total = current.reduce((sum, e) => sum + e.item.price * e.quantity, 0);
  return formatPrice(total, currency);
}

/** Display name for a cart item — the string form used by cartDisplayName (cartDisplay.tsx). */
export function cartItemDisplayName(item: ShopItem): string {
  return item.type === 'digital' ? `${item.name}` : item.name;
}

export function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style:    'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

/**
 * Parses a price value from YAML into the smallest currency unit (cents).
 * Accepts both formats:
 *   price: 2990      → 2990  (already in cents)
 *   price: 29.90     → 2990  (decimal, converted)
 */
export function parsePrice(raw: unknown): number {
  const n = Number(raw);
  if (isNaN(n)) throw new Error(`Invalid price: ${raw}`);
  // If the value has a decimal point it's a human-friendly amount (e.g. 29.90)
  // — multiply by 100 and round to avoid floating-point drift.
  return String(raw).includes('.') ? Math.round(n * 100) : Math.round(n);
}