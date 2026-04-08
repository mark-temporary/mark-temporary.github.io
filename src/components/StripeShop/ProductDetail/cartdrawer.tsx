/**
 * CartDrawerStandalone
 *
 * Cart drawer for use on ProductDetail pages.
 * Works from raw PersistedEntry[] (id + quantity only) since the detail
 * page only has one item's full data. Names/prices are shown from the
 * stored ID where known, with a graceful fallback.
 */

import type { ReactNode } from 'react';
import React from 'react';
import type { PersistedEntry } from '@site/src/components/Shop/cart';
import styles from './styles.module.css';

export function CartDrawerStandalone({
  cart,
  onUpdateQty,
  onRemove,
  onCheckout,
  loading,
  error,
  onClose,
}: {
  cart:         PersistedEntry[];
  onUpdateQty:  (id: string, delta: number) => void;
  onRemove:     (id: string) => void;
  onCheckout:   () => void;
  loading:      boolean;
  error:        string | null;
  onClose:      () => void;
}): ReactNode {
  return (
    <div className={styles.drawerBackdrop} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}
        role="dialog" aria-label="Shopping cart" aria-modal="true">
        <div className={styles.drawerHeader}>
          <h2 className={styles.drawerTitle}>Cart</h2>
          <button className={styles.drawerClose} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {cart.length === 0 ? (
          <p className={styles.emptyCart}>Your cart is empty.</p>
        ) : (
          <>
            <ul className={styles.cartList}>
              {cart.map(({ id, quantity }) => (
                <li key={id} className={styles.cartRow}>
                  <div className={styles.cartRowBody}>
                    <span className={styles.cartRowName}>{id}</span>
                    <span className={styles.cartRowQtyNote}>× {quantity}</span>
                  </div>
                  <div className={styles.cartQty}>
                    <button className={styles.qtyBtn} onClick={() => onUpdateQty(id, -1)} aria-label="Decrease">−</button>
                    <span className={styles.qtyValue}>{quantity}</span>
                    <button className={styles.qtyBtn} onClick={() => onUpdateQty(id, 1)} aria-label="Increase">+</button>
                    <button className={styles.removeBtn} onClick={() => onRemove(id)} aria-label="Remove">🗑</button>
                  </div>
                </li>
              ))}
            </ul>

            <p className={styles.drawerNote}>
              Prices confirmed at checkout.
            </p>

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