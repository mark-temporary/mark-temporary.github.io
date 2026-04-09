/**
 * JSX display helpers for cart items.
 * Kept separate from cart.ts so that file stays pure TypeScript with no JSX dependency.
 */
import React, { type ReactNode } from 'react';
import type { ShopItem } from './types';

const SUB = { fontWeight: 'normal' as const, opacity: 0.7, fontSize: '0.82em' };

/**
 * Renders the cart item name with optional sub-lines for:
 *   - Variant label  (split from name on " — ", e.g. "T-Shirt — Red / S")
 *   - Digital Download badge
 */
export function CartItemName({ item }: { item: ShopItem }): ReactNode {
  // Variant names are stored as "Product Name — Variant Label"
  const separatorIdx = item.name.indexOf(' — ');
  const baseName     = separatorIdx !== -1 ? item.name.slice(0, separatorIdx) : item.name;
  const variantLabel = separatorIdx !== -1 ? item.name.slice(separatorIdx + 3) : null;

  return (
    <>
      {baseName}
      {variantLabel && (
        <>
          <br />
          <span style={SUB}>{variantLabel}</span>
        </>
      )}
      {item.type === 'digital' && (
        <>
          <br />
          <span style={SUB}>(Digital Download)</span>
        </>
      )}
    </>
  );
}