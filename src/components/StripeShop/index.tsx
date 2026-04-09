/**
 * StripeShop
 *
 * Stripe Checkout (hosted) product grid with persistent cart.
 *
 * Usage — YAML catalogue (recommended, single source of truth):
 *   <StripeShop config="shop.yml" />
 *
 *   shop.yml:
 *     checkoutEndpoint: /api/create-checkout-session
 *     currency: chf
 *     items:
 *       - config: product-detail/plushy.yml   # reads price/name/etc from there
 *       - config: product-detail/game.yml
 *
 * Usage — inline items (no YAML file needed):
 *   <StripeShop
 *     currency="chf"
 *     items={[{ id: "x", name: "X", price: 999, currency: "chf" }]}
 *   />
 */

import type { ReactNode } from 'react';
import React, { useState, useEffect, useCallback } from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';
import type { ShopItem, ProductVariant } from './types';
import {
  type CartEntry,
  CART_STORAGE_KEY,
  loadCart, saveCart, clearCart,
  cartAdd, cartUpdate, cartRemove,
  cartTotalPrice, formatPrice, parsePrice,
} from './cart';
import { parseYaml, type YamlMap } from './yaml';
import { CartItemName } from './CartDisplay';

export type { ShopItem } from './types';
export type { CartEntry } from './cart';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface StripeShopProps {
  config?:           string;      // path to catalogue YAML in /static
  items?:            ShopItem[];  // inline alternative to config
  checkoutEndpoint?: string;
  currency?:         string;
}

// ---------------------------------------------------------------------------
// YAML helpers
// ---------------------------------------------------------------------------

function shopItemFromYaml(r: YamlMap): ShopItem {
  if (!r.id || !r.name) throw new Error(`Product YAML is missing id or name.`);

  const rawVariants = r.variants as YamlMap[] | undefined;
  const variants: ProductVariant[] | undefined = Array.isArray(rawVariants)
    ? rawVariants.map(v => ({
        id:       String(v.id),
        label:    String(v.label),
        price:    parsePrice(v.price),
        currency: v.currency ? String(v.currency) : undefined,
      }))
    : undefined;

  // price is required only when there are no variants
  if (!variants && !r.price) throw new Error(`Product YAML is missing price (or variants).`);

  return {
    id:          String(r.id),
    name:        String(r.name),
    price:       variants ? variants[0].price : parsePrice(r.price),
    currency:    r.currency    ? String(r.currency)    : undefined,
    maxQuantity: r.maxQuantity ? Number(r.maxQuantity) : undefined,
    image:       r.image       ? String(r.image)       : undefined,
    detailUrl:   r.detailUrl   ? String(r.detailUrl)   : undefined,
    type:        r.type === 'digital' ? 'digital' : 'physical',
    description: r.description ? String(r.description) : undefined,
    variants,
  };
}

async function loadCatalogueItems(doc: YamlMap): Promise<ShopItem[]> {
  const raw = doc.items as YamlMap[];
  if (!Array.isArray(raw)) throw new Error('Shop YAML must have a top-level `items` array.');
  return Promise.all(raw.map(async entry => {
    if (entry.config) {
      const url = '/' + String(entry.config).replace(/^\//, '');
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Could not load "${entry.config}": HTTP ${res.status}`);
      return shopItemFromYaml(parseYaml(await res.text()));
    }
    return shopItemFromYaml(entry);
  }));
}

// ---------------------------------------------------------------------------
// CartDrawer (used only by StripeShop, not exported)
// ---------------------------------------------------------------------------

function CartDrawer({ cart, currency, onUpdateQty, onRemove, onCheckout, loading, error, onClose }: {
  cart:        CartEntry[];
  currency:    string;
  onUpdateQty: (id: string, delta: number) => void;
  onRemove:    (id: string) => void;
  onCheckout:  () => void;
  loading:     boolean;
  error:       string | null;
  onClose:     () => void;
}): ReactNode {
  return (
    <div className={styles.drawerBackdrop} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}
        role="dialog" aria-label="Shopping cart" aria-modal="true">

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
                        ? <Link href={item.detailUrl}><CartItemName item={item} /></Link>
                        : <CartItemName item={item} />}
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
              <span className={styles.totalValue}>{cartTotalPrice(cart, currency)}</span>
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
// ProductCard
// ---------------------------------------------------------------------------

function ProductCard({ item, currency, onAdd }: {
  item:     ShopItem;
  currency: string;
  onAdd:    (item: ShopItem) => void;
}): ReactNode {
  const isDigital = item.type === 'digital';
  const hasVariants = item.variants && item.variants.length > 0;
  const [selectedVariantId, setSelectedVariantId] = useState(
    hasVariants ? item.variants![0].id : ''
  );

  const selectedVariant = hasVariants
    ? item.variants!.find(v => v.id === selectedVariantId) ?? item.variants![0]
    : null;

  const displayPrice  = selectedVariant
    ? formatPrice(selectedVariant.price, selectedVariant.currency ?? item.currency ?? currency)
    : formatPrice(item.price, item.currency ?? currency);

  const handleAdd = () => {
    if (selectedVariant) {
      // Flatten the variant into a cart-ready ShopItem
      onAdd({
        ...item,
        id:       selectedVariant.id,
        name:     `${item.name} — ${selectedVariant.label}`,
        price:    selectedVariant.price,
        currency: selectedVariant.currency ?? item.currency,
        variants: undefined, // cart entries are always flat
      });
    } else {
      onAdd(item);
    }
  };

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
          <span className={styles.digitalBadge} aria-label="Digital download" title="Digital download — no physical product">
            <svg className={styles.digitalIcon} viewBox="0 0 16 16" fill="none" aria-hidden="true">
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
        {item.description && <p className={styles.cardDesc}>{item.description}</p>}

        {hasVariants && (
          <select
            className={styles.variantSelect}
            value={selectedVariantId}
            onChange={e => setSelectedVariantId(e.target.value)}
            aria-label="Select variant"
          >
            {item.variants!.map(v => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        )}

        <div className={styles.cardFooter}>
          <span className={styles.cardPrice}>{displayPrice}</span>
          <button className={styles.addBtn} onClick={handleAdd}>
            Add to cart
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function StripeShop({
  config,
  items:            itemsProp,
  checkoutEndpoint: endpointProp,
  currency:         currencyProp = 'usd',
}: StripeShopProps): ReactNode {
  const yamlPath = useBaseUrl((config ?? '').replace(/^\//, ''));

  const [items,      setItems     ] = useState<ShopItem[]>(itemsProp ?? []);
  const [endpoint,   setEndpoint  ] = useState(endpointProp ?? '/api/create-checkout-session');
  const [currency,   setCurrency  ] = useState(currencyProp);
  const [loadErr,    setLoadErr   ] = useState<string | null>(null);
  const [itemsReady, setItemsReady] = useState(!config);

  // Load catalogue YAML (and per-product YAMLs it references)
  useEffect(() => {
    if (!config) { setItems(itemsProp ?? []); setItemsReady(true); return; }
    let cancelled = false;
    fetch(yamlPath)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(async text => {
        if (cancelled) return;
        const doc = parseYaml(text);
        const resolved = await loadCatalogueItems(doc);
        if (cancelled) return;
        setItems(resolved);
        if (doc.checkoutEndpoint) setEndpoint(String(doc.checkoutEndpoint));
        if (doc.currency)         setCurrency(String(doc.currency));
        setItemsReady(true);
      })
      .catch(err => { if (!cancelled) setLoadErr(err.message); });
    return () => { cancelled = true; };
  }, [config, yamlPath]);

  // Cart — loaded once from storage on mount, never wiped by the YAML load
  const [cart,       setCart      ] = useState<CartEntry[]>(() => loadCart());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading,    setLoading   ] = useState(false);
  const [error,      setError     ] = useState<string | null>(null);

  // Persist to sessionStorage after every cart change.
  // Guard on itemsReady so we never overwrite stored cart with [] during
  // the async window before the catalogue finishes loading.
  useEffect(() => {
    if (!itemsReady) return;
    saveCart(cart);
  }, [cart, itemsReady]);

  // Cross-tab sync only — we intentionally do NOT listen to hf-cart-updated
  // here because StripeShop is the one dispatching it (via saveCart above).
  // Listening to our own events would create: save → event → reload → save loop.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) setCart(loadCart());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const totalItems = cart.reduce((n, e) => n + e.quantity, 0);

  const addToCart  = useCallback((item: ShopItem) => {
    setCart(prev => cartAdd(prev, item));
    setDrawerOpen(true);
  }, []);

  const updateQty  = useCallback((id: string, delta: number) => {
    setCart(prev => cartUpdate(prev, id, delta));
  }, []);

  const removeItem = useCallback((id: string) => {
    setCart(prev => cartRemove(prev, id));
  }, []);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
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

  if (loadErr) {
    return (
      <div style={{ border: '1px solid var(--ifm-color-danger)', padding: '1rem', borderRadius: 4 }}>
        <strong>StripeShop error:</strong> {loadErr}
      </div>
    );
  }

  return (
    <div className={styles.shop}>
      {/* <div className={styles.cartBtnWrapper}>
        <button className={styles.cartBtn} onClick={() => setDrawerOpen(true)}
          aria-label={`Open cart, ${totalItems} item${totalItems !== 1 ? 's' : ''}`}>
          🛒
          {totalItems > 0 && <span className={styles.cartBadge}>{totalItems}</span>}
        </button>
      </div> */}

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