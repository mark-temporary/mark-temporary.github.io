/**
 * ProductDetail
 *
 * Full-page product detail component. Drop into a .mdx file:
 *
 *   ---
 *   title: Ferret Plushie
 *   ---
 *   import ProductDetail from '@site/src/components/ProductDetail';
 *   <ProductDetail config="shop/ferret-plushie.yaml" />
 *
 * YAML schema:
 *
 *   # --- Shop item (must match the Shop component's items array) ---
 *   id:          ferret-plushie
 *   name:        Ferret Plushie
 *   price:       2990               # cents / smallest unit
 *   currency:    chf
 *   maxQuantity: 10
 *
 *   # --- Detail page content ---
 *   images:                         # at least one; first is shown by default
 *     - /img/plushie-front.jpg
 *     - /img/plushie-back.jpg
 *     - /img/plushie-detail.jpg
 *
 *   body: |                         # free-form Markdown rendered on the left
 *     ## About this product
 *     Hand-sewn from premium materials...
 *
 *   facts:                          # key/value pairs shown on the right
 *     - label: Genre
 *       value: Plush toy
 *     - label: Material
 *       value: Organic cotton
 *     - label: Dimensions
 *       value: 25 × 18 × 12 cm
 *     - label: Age rating
 *       value: "3+"
 *
 *   checkoutEndpoint: /api/create-checkout-session   # optional, same default
 */

import type { ReactNode } from 'react';
import React, { useEffect, useState, useCallback } from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import ReactMarkdown from 'react-markdown';
import type { ShopItem, ProductVariant } from '@site/src/components/StripeShop/types';
import {
  type CartEntry,
  CART_STORAGE_KEY,
  loadCart, saveCart, clearCart,
  cartAdd, cartUpdate, cartRemove, cartTotalItems,
  formatPrice, parsePrice, isDigitalOnly,
} from '@site/src/components/StripeShop/cart';
import { parseYaml, type YamlMap } from '@site/src/components/StripeShop/yaml';
import styles from './styles.module.css';
import { CartDrawerStandalone } from './CartDrawer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Fact  { label: string; value: string; }

interface ProductDetailData extends ShopItem {
  images:            string[];
  body?:             string;
  facts?:            Fact[];
  checkoutEndpoint?: string;
}

function validateData(raw: YamlMap): ProductDetailData {
  if (!raw.id || !raw.name || !raw.images) {
    throw new Error(`Product YAML missing: ${['id','name','images'].filter(k => !raw[k]).join(', ')}`);
  }

  const rawVariants = raw.variants as YamlMap[] | undefined;
  const variants: ProductVariant[] | undefined = Array.isArray(rawVariants)
    ? rawVariants.map(v => ({
        id:       String(v.id),
        label:    String(v.label),
        price:    parsePrice(v.price),
        currency: v.currency ? String(v.currency) : undefined,
      }))
    : undefined;

  if (!variants && !raw.price) throw new Error('Product YAML missing price (or variants).');

  return {
    id:               String(raw.id),
    name:             String(raw.name),
    price:            variants ? variants[0].price : parsePrice(raw.price),
    currency:         raw.currency    ? String(raw.currency)    : 'usd',
    maxQuantity:      raw.maxQuantity ? Number(raw.maxQuantity) : undefined,
    type:             raw.type === 'digital' ? 'digital' : 'physical',
    image:            raw.image     ? String(raw.image)     : undefined,
    detailUrl:        raw.detailUrl ? String(raw.detailUrl) : undefined,
    variants,
    images:           (raw.images as string[]),
    body:             raw.body   ? String(raw.body)   : undefined,
    checkoutEndpoint: raw.checkoutEndpoint ? String(raw.checkoutEndpoint) : undefined,
    facts: Array.isArray(raw.facts)
      ? (raw.facts as YamlMap[]).map(f => ({ label: String(f.label), value: String(f.value) }))
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Image carousel (simple prev/next, no 3D — keeps the detail page light)
// ---------------------------------------------------------------------------

function ImageCarousel({ images, name }: { images: string[]; name: string }): ReactNode {
  const [idx, setIdx] = useState(0);
  const prev = () => setIdx(i => (i - 1 + images.length) % images.length);
  const next = () => setIdx(i => (i + 1) % images.length);

  return (
    <div className={styles.carousel}>
      <div className={styles.carouselMain}>
        <img
          key={idx}
          src={images[idx]}
          alt={`${name} — image ${idx + 1} of ${images.length}`}
          className={styles.carouselImg}
        />
        {images.length > 1 && (
          <>
            <button className={`${styles.carouselArrow} ${styles.carouselPrev}`}
              onClick={prev} aria-label="Previous image">&#9664;</button>
            <button className={`${styles.carouselArrow} ${styles.carouselNext}`}
              onClick={next} aria-label="Next image">&#9654;</button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className={styles.carouselThumbs}>
          {images.map((src, i) => (
            <button key={src} onClick={() => setIdx(i)}
              className={`${styles.thumb} ${i === idx ? styles.thumbActive : ''}`}
              aria-label={`View image ${i + 1}`}>
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ProductDetail({ config }: { config: string }): ReactNode {
  const [data,       setData      ] = useState<ProductDetailData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [cart,       setCart      ] = useState<CartEntry[]>(() => loadCart());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [added,      setAdded     ] = useState(false);
  const [loading,    setLoading   ] = useState(false);
  const [checkoutErr,setCheckoutErr] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');

  const yamlPath = useBaseUrl(config.replace(/^\//, ''));

  // Load YAML
  useEffect(() => {
    let cancelled = false;
    fetch(yamlPath)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(text => {
        if (!cancelled) {
          const d = validateData(parseYaml(text));
          setData(d);
          if (d.variants && d.variants.length > 0) setSelectedVariantId(d.variants[0].id);
        }
      })
      .catch(err => { if (!cancelled) setFetchError(err.message); });
    return () => { cancelled = true; };
  }, [yamlPath]);

  // Sync cart from same-tab (hf-cart-updated) and cross-tab (storage) updates
  useEffect(() => {
    const onUpdate = () => setCart(loadCart());
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

  const totalItems = cartTotalItems(cart);

  const handleAdd = useCallback(() => {
    if (!data) return;
    const selectedVariant = data.variants?.find(v => v.id === selectedVariantId);
    const cartItem: ShopItem = selectedVariant
      ? {
          ...data,
          id:       selectedVariant.id,
          name:     `${data.name} — ${selectedVariant.label}`,
          price:    selectedVariant.price,
          currency: selectedVariant.currency ?? data.currency,
          variants: undefined,
        }
      : { ...data, variants: undefined };

    setCart(prev => {
      const updated = cartAdd(prev, cartItem);
      saveCart(updated);
      return updated;
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }, [data, selectedVariantId]);

  const handleCheckout = async (country: string) => {
    if (!data) return;
    setLoading(true);
    setCheckoutErr(null);
    const endpoint = data.checkoutEndpoint ?? '/api/create-checkout-session';
    try {
      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          lineItems: cart.map(({ item, quantity }) => ({ itemId: item.id, quantity })),
          country,
          digitalOnly: isDigitalOnly(cart),
        }),
      });
      if (!res.ok) throw new Error(await res.text() || `Server error ${res.status}`);
      const { url } = await res.json();
      if (!url) throw new Error('No checkout URL returned.');
      clearCart();
      setCart([]);
      window.location.href = url;
    } catch (err: unknown) {
      setCheckoutErr(err instanceof Error ? err.message : 'Something went wrong.');
      setLoading(false);
    }
  };

  if (fetchError) {
    return (
      <div className={styles.errorBox} role="alert">
        <strong>ProductDetail error:</strong> {fetchError}
        <br /><code>{config}</code>
      </div>
    );
  }

  if (!data) {
    return <div className={styles.loading}>Loading…</div>;
  }

  const currency = data.currency ?? 'usd';
  const hasVariants = data.variants && data.variants.length > 0;
  const selectedVariant = hasVariants
    ? data.variants!.find(v => v.id === selectedVariantId) ?? data.variants![0]
    : null;
  const displayPrice = selectedVariant
    ? formatPrice(selectedVariant.price, selectedVariant.currency ?? currency)
    : formatPrice(data.price, currency);
  const inCart = cart.find(e =>
    e.item.id === (selectedVariant ? selectedVariant.id : data.id)
  )?.quantity ?? 0;

  return (
    <div className={styles.page}>

      {/* ── Floating cart button ───────────────────────────────────────── */}
      {/* <div className={styles.cartBtnWrapper}>
        <button className={styles.cartBtn}
          onClick={() => setDrawerOpen(true)}
          aria-label={`Open cart, ${totalItems} item${totalItems !== 1 ? 's' : ''}`}>
          🛒
          {totalItems > 0 && <span className={styles.cartBadge}>{totalItems}</span>}
        </button>
      </div> */}

      {/* ── Image carousel ────────────────────────────────────────────── */}
      <ImageCarousel images={data.images} name={data.name} />

      {/* ── Two-column body ───────────────────────────────────────────── */}
      <div className={styles.body}>

        {/* Left — free-form markdown */}
        <div className={styles.bodyText}>
          {data.body
            ? <ReactMarkdown>{data.body}</ReactMarkdown>
            : <p className={styles.noBody}>No description provided.</p>}
        </div>

        {/* Right — product summary / facts */}
        <aside className={styles.summary}>
          <h2 className={styles.summaryTitle}>{data.name}</h2>
          <p className={styles.summaryPrice}>{displayPrice}</p>

          {data.facts && data.facts.length > 0 && (
            <dl className={styles.facts}>
              {data.facts.map(({ label, value }) => (
                <div key={label} className={styles.factRow}>
                  <dt className={styles.factLabel}>{label}</dt>
                  <dd className={styles.factValue}>{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {hasVariants && (
            <select
              className={styles.variantSelect}
              value={selectedVariantId}
              onChange={e => setSelectedVariantId(e.target.value)}
              aria-label="Select variant"
            >
              {data.variants!.map(v => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          )}

          <button
            className={`${styles.addBtn} ${added ? styles.addBtnAdded : ''}`}
            onClick={handleAdd}
            disabled={added}
          >
            {added ? '✓ Added!' : inCart > 0 ? `Add again (${inCart} in cart)` : 'Add to cart'}
          </button>
        </aside>
      </div>

      {/* ── Cart drawer ───────────────────────────────────────────────── */}
      {drawerOpen && (
        <CartDrawerStandalone
          cart={cart}
          currency={data.currency ?? 'usd'}
          onUpdateQty={(id, delta) => setCart(prev => { const u = cartUpdate(prev, id, delta); saveCart(u); return u; })}
          onRemove={(id) => setCart(prev => { const u = cartRemove(prev, id); saveCart(u); return u; })}
          onCheckout={handleCheckout}
          loading={loading}
          error={checkoutErr}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}