/**
 * CartDrawerStandalone — rich cart drawer for ProductDetail pages.
 *
 * Uses CartEntry[] (full item data in storage) so it can show thumbnails,
 * product names, per-line prices, a total, and respect maxQuantity — identical
 * to the StripeShop in-page drawer and the CartWidget navbar drawer.
 */

import type { ReactNode } from 'react';
import React, { useState } from 'react';
import Link from '@docusaurus/Link';
import type { CartEntry } from '@site/src/components/StripeShop/cart';
import { formatPrice, cartTotalPrice, loadCountry, saveCountry } from '@site/src/components/StripeShop/cart';
import { CartItemName } from '@site/src/components/StripeShop/CartDisplay';
import { SHIPPING_COUNTRIES } from '@site/src/components/StripeShop/countries';
import styles from './styles.module.css';

export function CartDrawerStandalone({
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
  onCheckout:   (country: string) => void;
  loading:      boolean;
  error:        string | null;
  onClose:      () => void;
}): ReactNode {
  const displayCurrency = cart[0]?.item.currency ?? currency;
  const [country, setCountry] = useState(() => loadCountry());

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
              {cart.map(({ item, quantity }) => (
                <li key={item.id} className={styles.cartRow}>
                  {item.image && (
                    <img src={item.image} alt={item.name} className={styles.cartThumb} />
                  )}
                  <div className={styles.cartRowBody}>
                    <span className={styles.cartRowName}>
                      {item.detailUrl
                        ? <Link href={item.detailUrl}><CartItemName item={item} /></Link>
                        : <CartItemName item={item} />}
                    </span>
                    <span className={styles.cartRowPrice}>
                      {formatPrice(item.price * quantity, item.currency ?? currency)}
                    </span>
                  </div>
                  <div className={styles.cartQty}>
                    <button className={styles.qtyBtn}
                      onClick={() => onUpdateQty(item.id, -1)} aria-label="Decrease">−</button>
                    <span className={styles.qtyValue}>{quantity}</span>
                    <button className={styles.qtyBtn}
                      onClick={() => onUpdateQty(item.id, 1)}
                      disabled={quantity >= (item.maxQuantity ?? 99)}
                      aria-label="Increase">+</button>
                    <button className={styles.removeBtn}
                      onClick={() => onRemove(item.id)} aria-label="Remove">🗑</button>
                  </div>
                </li>
              ))}
            </ul>

            <div className={styles.cartSummary}>
              <span className={styles.totalLabel}>Total</span>
              <span className={styles.totalValue}>{cartTotalPrice(cart, displayCurrency)}</span>
            </div>

            <div className={styles.countryRow}>
              <label htmlFor="pd-country" className={styles.countryLabel}>Ship to</label>
              <select
                id="pd-country"
                className={styles.countrySelect}
                value={country}
                onChange={e => { setCountry(e.target.value); saveCountry(e.target.value); }}
              >
                <option value="">— Select country —</option>
                {SHIPPING_COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>

            {error && <p className={styles.checkoutError} role="alert">{error}</p>}

            <button className={styles.checkoutBtn} onClick={() => onCheckout(country)} disabled={loading || !country}>
              {loading ? 'Redirecting…' : 'Checkout with Stripe'}
            </button>
            {!country && (
              <p className={styles.countryHint}>Please select a shipping country to continue.</p>
            )}
            <p className={styles.checkoutNote}>
              Secure payment powered by Stripe. Google Pay &amp; Apple Pay accepted.
            </p>
          </>
        )}
      </div>
    </div>
  );
}