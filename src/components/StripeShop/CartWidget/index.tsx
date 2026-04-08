/**
 * CartWidget
 *
 * Navbar cart button + full rich drawer. Drop into your swizzled Navbar:
 *
 *   // src/theme/Navbar/index.tsx
 *   import Navbar from '@theme-original/Navbar';
 *   import CartWidget from '@site/src/components/StripeShop/CartWidget';
 *
 *   export default function NavbarWrapper(props) {
 *     return (
 *       <>
 *         <Navbar {...props} />
 *         <CartWidget checkoutEndpoint="/api/create-checkout-session" />
 *       </>
 *     );
 *   }
 *
 * Reads cart state from sessionStorage and stays in sync with StripeShop
 * and ProductDetail via the 'hf-cart-updated' custom event (same tab) and
 * the native 'storage' event (other tabs).
 */

import type { ReactNode } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from '@docusaurus/Link';
import {
  type CartEntry,
  CART_STORAGE_KEY,
  loadCart, saveCart, clearCart,
  cartUpdate, cartRemove,
  cartTotalItems, cartTotalPrice,
  formatPrice,
} from '@site/src/components/StripeShop/cart';
import { CartItemName } from '@site/src/components/StripeShop/CartDisplay';
import styles from './styles.module.css';

export interface CartWidgetProps {
  checkoutEndpoint?: string;
  currency?:         string;
}

export default function CartWidget({
  checkoutEndpoint = 'https://super-glade-5406.bauermeistermarkusdev.workers.dev/',
  currency         = 'usd',
}: CartWidgetProps): ReactNode {
  const [cart,    setCart   ] = useState<CartEntry[]>(() => loadCart());
  const [open,    setOpen   ] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState<string | null>(null);
  const [bump,    setBump   ] = useState(false);

  const totalItems = cartTotalItems(cart);
  const prevTotal  = useRef(totalItems);

  // Sync with StripeShop and ProductDetail.
  // hf-cart-updated = same tab (fired by saveCart/clearCart)
  // storage         = other tabs
  useEffect(() => {
    const onUpdate = () => {
      const updated = loadCart();
      if (cartTotalItems(updated) > prevTotal.current) setBump(true);
      setCart(updated);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) onUpdate();
    };
    window.addEventListener('hf-cart-updated', onUpdate);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('hf-cart-updated', onUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    prevTotal.current = totalItems;
    if (bump) {
      const t = setTimeout(() => setBump(false), 400);
      return () => clearTimeout(t);
    }
  }, [totalItems, bump]);

  const updateQty = useCallback((id: string, delta: number) => {
    setCart(prev => {
      const updated = cartUpdate(prev, id, delta);
      saveCart(updated);
      return updated;
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setCart(prev => {
      const updated = cartRemove(prev, id);
      saveCart(updated);
      return updated;
    });
  }, []);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(checkoutEndpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain' },
        body:    JSON.stringify({
          lineItems: cart.map(({ item, quantity }) => ({ itemId: item.id, quantity })),
        }),
      });
      if (!res.ok) throw new Error(await res.text() || `Server error ${res.status}`);
      const { url } = await res.json();
      if (!url) throw new Error('No checkout URL returned.');
      clearCart();
      setCart([]);
      window.location.href = url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setLoading(false);
    }
  };

  const displayCurrency = cart[0]?.item.currency ?? currency;

  return (
    <>
      {/* Cart button */}
      <button
        className={styles.cartBtn}
        onClick={() => setOpen(true)}
        aria-label={`Open cart, ${totalItems} item${totalItems !== 1 ? 's' : ''}`}
      >
        <svg className={styles.cartIcon} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true">
          <circle cx="9" cy="21" r="1"/>
          <circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/>
        </svg>
        {totalItems > 0 && (
          <span className={`${styles.badge} ${bump ? styles.badgeBump : ''}`}>
            {totalItems}
          </span>
        )}
      </button>

      {/* Cart drawer */}
      {open && (
        <div className={styles.backdrop} onClick={() => setOpen(false)}>
          <div className={styles.drawer} onClick={e => e.stopPropagation()}
            role="dialog" aria-label="Shopping cart" aria-modal="true">

            <div className={styles.header}>
              <h2 className={styles.title}>Cart</h2>
              <button className={styles.close} onClick={() => setOpen(false)} aria-label="Close cart">✕</button>
            </div>

            {cart.length === 0 ? (
              <p className={styles.empty}>Your cart is empty.</p>
            ) : (
              <>
                <ul className={styles.list}>
                  {cart.map(({ item, quantity }) => (
                    <li key={item.id} className={styles.row}>
                      {item.image && (
                        <img src={item.image} alt={item.name} className={styles.thumb} />
                      )}
                      <div className={styles.rowBody}>
                        <span className={styles.rowName}>
                          {item.detailUrl
                            ? <Link href={item.detailUrl}><CartItemName item={item} /></Link>
                            : <CartItemName item={item} />}
                        </span>
                        <span className={styles.rowPrice}>
                          {formatPrice(item.price * quantity, item.currency ?? currency)}
                        </span>
                      </div>
                      <div className={styles.rowActions}>
                        <button className={styles.qtyBtn}
                          onClick={() => updateQty(item.id, -1)} aria-label="Decrease">−</button>
                        <span className={styles.qtyVal}>{quantity}</span>
                        <button className={styles.qtyBtn}
                          onClick={() => updateQty(item.id, 1)}
                          disabled={quantity >= (item.maxQuantity ?? 99)}
                          aria-label="Increase">+</button>
                        <button className={styles.removeBtn}
                          onClick={() => removeItem(item.id)} aria-label="Remove">🗑</button>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className={styles.summary}>
                  <span className={styles.totalLabel}>Total</span>
                  <span className={styles.totalValue}>{cartTotalPrice(cart, displayCurrency)}</span>
                </div>

                {error && <p className={styles.error} role="alert">{error}</p>}

                <button className={styles.checkoutBtn} onClick={handleCheckout} disabled={loading}>
                  {loading ? 'Redirecting…' : 'Checkout with Stripe'}
                </button>
                <p className={styles.checkoutNote}>
                  Secure payment powered by Stripe. Google Pay &amp; Apple Pay accepted.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}