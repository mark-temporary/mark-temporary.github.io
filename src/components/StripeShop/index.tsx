/**
 * Shop
 *
 * A Stripe Checkout (hosted) shop component.
 *
 * Usage in any .mdx or .tsx page:
 *
 *   <Shop
 *     items={[
 *       {
 *         id:          "ferret-plushie",
 *         name:        "Ferret Plushie",
 *         description: "A soft ferret friend for your desk.",
 *         price:       1999,        // in the smallest currency unit (cents)
 *         currency:    "chf",
 *         image:       "/img/ferret-plushie.jpg",
 *         maxQuantity: 10,
 *       },
 *     ]}
 *     checkoutEndpoint="/api/create-checkout-session"
 *   />
 *
 * Props:
 *   items              Array of ShopItem objects to display.
 *   checkoutEndpoint   URL of your backend endpoint that creates a Stripe
 *                      Checkout Session and returns { url: string }.
 *                      Defaults to "/api/create-checkout-session".
 *   currency           Default currency for all items (overridden per-item).
 *                      Defaults to "usd".
 */

import type { ReactNode } from 'react';
import React, { useState, useEffect, useCallback } from 'react';
import styles from './styles.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShopItem {
  /** Unique identifier passed to the backend to look up price/product. */
  id:           string;
  name:         string;
  description?: string;
  /** Price in the smallest currency unit (e.g. cents for USD/CHF/EUR). */
  price:        number;
  currency?:    string;
  image?:       string;
  /** Maximum quantity the user can add to cart. Default: 99. */
  maxQuantity?: number;
}

export interface ShopProps {
  items:               ShopItem[];
  checkoutEndpoint?:   string;
  currency?:           string;
}

interface CartEntry {
  item:     ShopItem;
  quantity: number;
}

// ---------------------------------------------------------------------------
// Cart persistence — sessionStorage
//
// sessionStorage survives page navigations within the same tab (including
// the Stripe redirect → back-button flow) but is cleared when the tab or
// browser closes, giving it the same lifetime as a traditional session cookie
// without polluting every HTTP request with cookie headers.
//
// The cart is stored as a plain JSON array of { id, quantity } tuples.
// Full item data (name, price, image …) is always sourced from the `items`
// prop so stale cached prices can never reach the checkout.
// ---------------------------------------------------------------------------

const CART_STORAGE_KEY = 'hf-shop-cart';

interface PersistedEntry {
  id:       string;
  quantity: number;
}

function loadCart(items: ShopItem[]): CartEntry[] {
  try {
    const raw = sessionStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const persisted: PersistedEntry[] = JSON.parse(raw);
    // Re-hydrate from current items prop so prices/names are always fresh
    return persisted.flatMap(({ id, quantity }) => {
      const item = items.find(i => i.id === id);
      if (!item || quantity < 1) return [];
      return [{ item, quantity: Math.min(quantity, item.maxQuantity ?? 99) }];
    });
  } catch {
    return [];
  }
}

function saveCart(cart: CartEntry[]): void {
  try {
    const persisted: PersistedEntry[] = cart.map(({ item, quantity }) => ({
      id: item.id,
      quantity,
    }));
    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(persisted));
  } catch { /* private browsing or storage full — silently ignore */ }
}

function clearCart(): void {
  try {
    sessionStorage.removeItem(CART_STORAGE_KEY);
  } catch {}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style:    'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

function cartTotal(cart: CartEntry[], defaultCurrency: string): string {
  if (cart.length === 0) return '';
  // Use the first item's currency as the display currency (all items should
  // share a currency in a single checkout session).
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
  return (
    <div className={styles.card}>
      {item.image && (
        <div className={styles.cardImgWrapper}>
          <img src={item.image} alt={item.name} className={styles.cardImg} />
        </div>
      )}
      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>{item.name}</h3>
        {item.description && (
          <p className={styles.cardDesc}>{item.description}</p>
        )}
        <div className={styles.cardFooter}>
          <span className={styles.cardPrice}>
            {formatPrice(item.price, displayCurrency)}
          </span>
          <button
            className={styles.addBtn}
            onClick={() => onAdd(item)}
          >
            Add to cart
          </button>
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
                    <span className={styles.cartRowName}>{item.name}</span>
                    <span className={styles.cartRowPrice}>
                      {formatPrice(item.price * quantity, item.currency ?? currency)}
                    </span>
                  </div>
                  <div className={styles.cartQty}>
                    <button
                      className={styles.qtyBtn}
                      onClick={() => onUpdateQty(item.id, -1)}
                      aria-label="Decrease quantity"
                    >−</button>
                    <span className={styles.qtyValue}>{quantity}</span>
                    <button
                      className={styles.qtyBtn}
                      onClick={() => onUpdateQty(item.id, 1)}
                      disabled={quantity >= (item.maxQuantity ?? 99)}
                      aria-label="Increase quantity"
                    >+</button>
                    <button
                      className={styles.removeBtn}
                      onClick={() => onRemove(item.id)}
                      aria-label="Remove item"
                    >🗑</button>
                  </div>
                </li>
              ))}
            </ul>

            <div className={styles.cartSummary}>
              <span className={styles.totalLabel}>Total</span>
              <span className={styles.totalValue}>{cartTotal(cart, currency)}</span>
            </div>

            {error && (
              <p className={styles.checkoutError} role="alert">{error}</p>
            )}

            <button
              className={styles.checkoutBtn}
              onClick={onCheckout}
              disabled={loading}
            >
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
  const [cart,        setCart       ] = useState<CartEntry[]>(() => loadCart(items));
  const [drawerOpen,  setDrawerOpen ] = useState(false);
  const [loading,     setLoading    ] = useState(false);
  const [error,       setError      ] = useState<string | null>(null);

  // Persist cart to sessionStorage whenever it changes
  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  const totalItems = cart.reduce((n, e) => n + e.quantity, 0);

  const addToCart = useCallback((item: ShopItem) => {
    setCart(prev => {
      const existing = prev.find(e => e.item.id === item.id);
      if (existing) {
        const max = item.maxQuantity ?? 99;
        if (existing.quantity >= max) return prev;
        return prev.map(e =>
          e.item.id === item.id ? { ...e, quantity: e.quantity + 1 } : e
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
    setDrawerOpen(true);
  }, []);

  const updateQty = useCallback((id: string, delta: number) => {
    setCart(prev =>
      prev
        .map(e => e.item.id === id ? { ...e, quantity: e.quantity + delta } : e)
        .filter(e => e.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setCart(prev => prev.filter(e => e.item.id !== id));
  }, []);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const lineItems = cart.map(({ item, quantity }) => ({
        itemId:   item.id,
        quantity,
      }));

      const res = await fetch(checkoutEndpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ lineItems }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Server error ${res.status}`);
      }

      const { url } = await res.json();
      if (!url) throw new Error('No checkout URL returned from server.');

      // Clear the cart before handing off — Stripe's success_url should
      // be a dedicated page so the user doesn't return to a stale cart.
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
      {/* Floating cart button */}
      <div className={styles.cartBtnWrapper}>
        <button
          className={styles.cartBtn}
          onClick={() => setDrawerOpen(true)}
          aria-label={`Open cart, ${totalItems} item${totalItems !== 1 ? 's' : ''}`}
        >
          🛒
          {totalItems > 0 && (
            <span className={styles.cartBadge}>{totalItems}</span>
          )}
        </button>
      </div>

      {/* Product grid */}
      <div className={styles.grid}>
        {items.map(item => (
          <ProductCard
            key={item.id}
            item={item}
            currency={currency}
            onAdd={addToCart}
          />
        ))}
      </div>

      {/* Cart drawer */}
      {drawerOpen && (
        <CartDrawer
          cart={cart}
          currency={currency}
          onUpdateQty={updateQty}
          onRemove={removeItem}
          onCheckout={handleCheckout}
          loading={loading}
          error={error}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}