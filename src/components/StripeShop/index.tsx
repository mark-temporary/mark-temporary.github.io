/**
 * Shop — Stripe Checkout (hosted) product grid with persistent cart.
 *
 * Usage:
 *   <Shop
 *     currency="chf"
 *     checkoutEndpoint="/api/create-checkout-session"
 *     items={[
 *       {
 *         id:          "ferret-plushie",
 *         name:        "Ferret Plushie",
 *         description: "A soft ferret friend for your desk.",
 *         price:       2990,
 *         currency:    "chf",
 *         image:       "/img/ferret-plushie.jpg",
 *         maxQuantity: 10,
 *         detailUrl:   "/shop/ferret-plushie",   // optional detail page link
 *       },
 *     ]}
 *   />
 */

import type { ReactNode } from 'react';
import React, { useState, useEffect, useCallback } from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';
import type { ShopItem } from './types';
import {
  CartEntry, PersistedEntry,
  CART_STORAGE_KEY,
  loadCart, loadRawCart, saveCart, clearCart,
  cartAdd, cartUpdate, cartRemove, cartTotalItems,
  formatPrice,
} from './cart';

export type { ShopItem } from './types';
export type { CartEntry } from './cart';

export interface ShopProps {
  items:              ShopItem[];
  checkoutEndpoint?:  string;
  currency?:          string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cartTotal(cart: CartEntry[], defaultCurrency: string): string {
  if (cart.length === 0) return '';
  const currency = cart[0].item.currency ?? defaultCurrency;
  const total = cart.reduce((sum, e) => sum + e.item.price * e.quantity, 0);
  return formatPrice(total, currency);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProductCard({
  item,
  currency,
  onAdd,
}: {
  item:     ShopItem;
  currency: string;
  onAdd:    (item: ShopItem) => void;
}): ReactNode {
  const displayCurrency = item.currency ?? currency;
  const isDigital = item.type === 'digital';
  return (
    <div className={styles.card}>
      <div className={styles.cardImgWrapper}>
        {item.image && (
          item.detailUrl
            ? <Link href={item.detailUrl} tabIndex={-1} aria-hidden>
                <img src={item.image} alt={item.name} className={styles.cardImg} />
              </Link>
            : <img src={item.image} alt={item.name} className={styles.cardImg} />
        )}
        {isDigital && (
          <span className={styles.digitalBadge} aria-label="Digital download only" title="Digital download — no physical product">
            <svg className={styles.digitalIcon} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              {/* Arrow pointing down into a tray — universally understood "download" symbol */}
              <path d="M8 1v8M5 6l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 11v1a2 2 0 002 2h8a2 2 0 002-2v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Digital
          </span>
        )}
      </div>
      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>
          {item.detailUrl
            ? <Link href={item.detailUrl}>{item.name}</Link>
            : item.name}
        </h3>
        {item.description && (
          <p className={styles.cardDesc}>{item.description}</p>
        )}
        <div className={styles.cardFooter}>
          <span className={styles.cardPrice}>
            {formatPrice(item.price, displayCurrency)}
          </span>
          <div className={styles.cardActions}>
            <button className={styles.addBtn} onClick={() => onAdd(item)}>
              Add to cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartDrawer({
  cart,
  currency,
  onUpdateQty,
  onRemove,
  onCheckout,
  loading,
  error,
  onClose,
}: {
  cart:         CartEntry[];
  currency:     string;
  onUpdateQty:  (id: string, delta: number) => void;
  onRemove:     (id: string) => void;
  onCheckout:   () => void;
  loading:      boolean;
  error:        string | null;
  onClose:      () => void;
}): ReactNode {
  return (
    <div className={styles.drawerBackdrop} onClick={onClose}>
      <div
        className={styles.drawer}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Shopping cart"
        aria-modal="true"
      >
        <div className={styles.drawerHeader}>
          <h2 className={styles.drawerTitle}>Cart</h2>
          <button className={styles.drawerClose} onClick={onClose} aria-label="Close cart">✕</button>
        </div>

        {cart.length === 0 ? (
          <p className={styles.emptyCart}>Your cart is empty.</p>
        ) : (
          <>
            <ul className={styles.cartList}>
              {cart.map(({ item, quantity }) => (
                <li key={item.id} className={styles.cartRow}>
                  {item.image && (
                    <img src={item.image} alt={item.name} className={styles.cartThumb} />
                  )}
                  <div className={styles.cartRowBody}>
                    <span className={styles.cartRowName}>
                      {item.detailUrl
                        ? <Link href={item.detailUrl}>{item.name}</Link>
                        : item.name}
                    </span>
                    <span className={styles.cartRowPrice}>
                      {formatPrice(item.price * quantity, item.currency ?? currency)}
                    </span>
                  </div>
                  <div className={styles.cartQty}>
                    <button className={styles.qtyBtn} onClick={() => onUpdateQty(item.id, -1)} aria-label="Decrease">−</button>
                    <span className={styles.qtyValue}>{quantity}</span>
                    <button className={styles.qtyBtn} onClick={() => onUpdateQty(item.id, 1)}
                      disabled={quantity >= (item.maxQuantity ?? 99)} aria-label="Increase">+</button>
                    <button className={styles.removeBtn} onClick={() => onRemove(item.id)} aria-label="Remove">🗑</button>
                  </div>
                </li>
              ))}
            </ul>

            <div className={styles.cartSummary}>
              <span className={styles.totalLabel}>Total</span>
              <span className={styles.totalValue}>{cartTotal(cart, currency)}</span>
            </div>

            {error && <p className={styles.checkoutError} role="alert">{error}</p>}

            <button className={styles.checkoutBtn} onClick={onCheckout} disabled={loading}>
              {loading ? 'Redirecting…' : 'Checkout with Stripe'}
            </button>

            <p className={styles.checkoutNote}>
              Secure payment powered by Stripe. Google Pay &amp; Apple Pay accepted.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Shop({
  items,
  checkoutEndpoint = '/api/create-checkout-session',
  currency         = 'usd',
}: ShopProps): ReactNode {
  const [cart,       setCart      ] = useState<CartEntry[]>(() => loadCart(items));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading,    setLoading   ] = useState(false);
  const [error,      setError     ] = useState<string | null>(null);

  // Persist on every cart change
  useEffect(() => {
    saveCart(cart.map(({ item, quantity }) => ({ id: item.id, quantity })));
  }, [cart]);

  // Re-hydrate if another tab/page updated storage (e.g. ProductDetail added an item)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) setCart(loadCart(items));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [items]);

  const totalItems = cart.reduce((n, e) => n + e.quantity, 0);

  const addToCart = useCallback((item: ShopItem) => {
    setCart(prev => {
      const raw = prev.map(e => ({ id: e.item.id, quantity: e.quantity }));
      const updated = cartAdd(raw, item);
      return updated.flatMap(({ id, quantity }) => {
        const it = items.find(i => i.id === id) ?? item;
        return [{ item: it, quantity }];
      });
    });
    setDrawerOpen(true);
  }, [items]);

  const updateQty = useCallback((id: string, delta: number) => {
    setCart(prev => {
      const raw = cartUpdate(prev.map(e => ({ id: e.item.id, quantity: e.quantity })), id, delta);
      return raw.flatMap(({ id: rid, quantity }) => {
        const it = prev.find(e => e.item.id === rid)?.item;
        return it ? [{ item: it, quantity }] : [];
      });
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setCart(prev => prev.filter(e => e.item.id !== id));
  }, []);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(checkoutEndpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ lineItems: cart.map(({ item, quantity }) => ({ itemId: item.id, quantity })) }),
      });
      if (!res.ok) throw new Error(await res.text() || `Server error ${res.status}`);
      const { url } = await res.json();
      if (!url) throw new Error('No checkout URL returned from server.');
      clearCart();
      setCart([]);
      window.location.href = url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className={styles.shop}>
      <div className={styles.cartBtnWrapper}>
        <button className={styles.cartBtn} onClick={() => setDrawerOpen(true)}
          aria-label={`Open cart, ${totalItems} item${totalItems !== 1 ? 's' : ''}`}>
          🛒
          {totalItems > 0 && <span className={styles.cartBadge}>{totalItems}</span>}
        </button>
      </div>

      <div className={styles.grid}>
        {items.map(item => (
          <ProductCard key={item.id} item={item} currency={currency} onAdd={addToCart} />
        ))}
      </div>

      {drawerOpen && (
        <CartDrawer
          cart={cart} currency={currency}
          onUpdateQty={updateQty} onRemove={removeItem}
          onCheckout={handleCheckout} loading={loading} error={error}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}