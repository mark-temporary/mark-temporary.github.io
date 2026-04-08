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
import type { ShopItem } from '@site/src/components/StripeShop/types';
import {
  PersistedEntry,
  CART_STORAGE_KEY,
  loadRawCart, saveCart, clearCart,
  cartAdd, cartUpdate, cartRemove, cartTotalItems,
  formatPrice,
} from '@site/src/components/StripeShop/cart';
import styles from './styles.module.css';
import { CartDrawerStandalone } from './cartdrawer';

// ---------------------------------------------------------------------------
// YAML parser (reused from Showcase — same minimal recursive-descent approach)
// ---------------------------------------------------------------------------

type YamlValue = string | YamlValue[] | Record<string, YamlValue>;
type YamlMap   = Record<string, YamlValue>;

function parseYaml(raw: string): YamlMap {
  const lines  = raw.replace(/\r\n/g, '\n').split('\n');
  let   cursor = 0;
  const indentOf  = (l: string) => l.match(/^(\s*)/)?.[1].length ?? 0;
  const isBlank   = (l: string) => /^\s*(#.*)?$/.test(l);
  const stripCmt  = (s: string) => s.replace(/(\s|^)#.*$/, '').trim();
  const unquote   = (s: string) => {
    const t = s.trim();
    return ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))
      ? t.slice(1, -1) : t;
  };
  const inlineSeq = (s: string): string[] => {
    const inner = s.slice(s.indexOf('[') + 1, s.lastIndexOf(']'));
    return inner ? inner.split(',').map(x => unquote(stripCmt(x))).filter(Boolean) : [];
  };
  const blockScalar = (fold: boolean, ownerIndent: number): string => {
    const buf: string[] = [];
    while (cursor < lines.length) {
      const ln = lines[cursor];
      if (!isBlank(ln) && indentOf(ln) <= ownerIndent) break;
      buf.push(ln.replace(/^\s{0,2}/, ''));
      cursor++;
    }
    while (buf.length && buf[buf.length - 1].trim() === '') buf.pop();
    return fold ? buf.join(' ').replace(/\s{2,}/g, ' ').trim() : buf.join('\n').trim();
  };
  function mapping(baseIndent: number): YamlMap {
    const map: YamlMap = {};
    while (cursor < lines.length) {
      const line = lines[cursor];
      if (isBlank(line)) { cursor++; continue; }
      if (indentOf(line) <= baseIndent) break;
      const km = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*):\s*(.*)/);
      if (!km) { cursor++; continue; }
      const [, ws, key, rest] = km; const ki = ws.length; cursor++;
      if (rest.trim() === '|' || rest.trim() === '>') { map[key] = blockScalar(rest.trim() === '>', ki); continue; }
      if (rest.trim().startsWith('['))                 { map[key] = inlineSeq(rest.trim()); continue; }
      if (rest.trim() === '') {
        let peek = cursor;
        while (peek < lines.length && isBlank(lines[peek])) peek++;
        if (peek < lines.length && indentOf(lines[peek]) > ki) {
          map[key] = /^\s*-\s/.test(lines[peek]) ? sequence(ki) : mapping(ki);
          continue;
        }
        map[key] = ''; continue;
      }
      map[key] = unquote(stripCmt(rest.trim()));
    }
    return map;
  }
  function sequence(baseIndent: number): YamlValue[] {
    const items: YamlValue[] = [];
    while (cursor < lines.length) {
      const line = lines[cursor];
      if (isBlank(line)) { cursor++; continue; }
      if (indentOf(line) <= baseIndent) break;
      const im = line.match(/^(\s*)-\s*(.*)/);
      if (!im) break;
      const [, ws, rest] = im; const ii = ws.length; cursor++;
      const ikm = rest.trim().match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)/);
      if (ikm) {
        const nested: YamlMap = {};
        const [, fk, fv] = ikm;
        if (fv.trim() === '|' || fv.trim() === '>') nested[fk] = blockScalar(fv.trim() === '>', ii);
        else if (fv.trim().startsWith('['))           nested[fk] = inlineSeq(fv.trim());
        else if (fv.trim() !== '')                    nested[fk] = unquote(stripCmt(fv.trim()));
        Object.assign(nested, mapping(ii));
        items.push(nested); continue;
      }
      if (rest.trim().startsWith('[')) { items.push(inlineSeq(rest.trim())); continue; }
      items.push(unquote(stripCmt(rest.trim())));
    }
    return items;
  }
  return mapping(-1);
}

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
  const missing = ['id','name','price','images'].filter(k => !raw[k]);
  if (missing.length) throw new Error(`Product YAML missing: ${missing.join(', ')}`);
  return {
    id:               String(raw.id),
    name:             String(raw.name),
    price:            Number(raw.price),
    currency:         raw.currency ? String(raw.currency) : 'usd',
    maxQuantity:      raw.maxQuantity ? Number(raw.maxQuantity) : undefined,
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
  const [cart,       setCart      ] = useState<PersistedEntry[]>(() => loadRawCart());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [added,      setAdded     ] = useState(false);
  const [loading,    setLoading   ] = useState(false);
  const [checkoutErr,setCheckoutErr] = useState<string | null>(null);

  const yamlPath = useBaseUrl(config.replace(/^\//, ''));

  // Load YAML
  useEffect(() => {
    let cancelled = false;
    fetch(yamlPath)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(text => { if (!cancelled) setData(validateData(parseYaml(text))); })
      .catch(err => { if (!cancelled) setFetchError(err.message); });
    return () => { cancelled = true; };
  }, [yamlPath]);

  // Sync cart from storage events (Shop on another page updated the cart)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) setCart(loadRawCart());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const totalItems = cartTotalItems(cart);

  const handleAdd = useCallback(() => {
    if (!data) return;
    setCart(prev => {
      const updated = cartAdd(prev, data);
      saveCart(updated);
      return updated;
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }, [data]);

  const handleCheckout = async () => {
    if (!data) return;
    setLoading(true);
    setCheckoutErr(null);
    const endpoint = data.checkoutEndpoint ?? '/api/create-checkout-session';
    try {
      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ lineItems: cart.map(({ id, quantity }) => ({ itemId: id, quantity })) }),
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
  const inCart   = cart.find(e => e.id === data.id)?.quantity ?? 0;

  return (
    <div className={styles.page}>

      {/* ── Floating cart button ───────────────────────────────────────── */}
      <div className={styles.cartBtnWrapper}>
        <button className={styles.cartBtn}
          onClick={() => setDrawerOpen(true)}
          aria-label={`Open cart, ${totalItems} item${totalItems !== 1 ? 's' : ''}`}>
          🛒
          {totalItems > 0 && <span className={styles.cartBadge}>{totalItems}</span>}
        </button>
      </div>

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
          <p className={styles.summaryPrice}>
            {formatPrice(data.price, currency)}
          </p>

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