/**
 * JSX display helpers for cart items.
 * Kept separate from cart.ts so that file stays pure TypeScript with no JSX dependency.
 */
import React, { type ReactNode } from 'react';
import type { ShopItem } from './types';

/**
 * Renders the cart item name. Digital products get "(Digital Download)"
 * on a second line in a lighter style.
 */
export function CartItemName({ item }: { item: ShopItem }): ReactNode {
  if (item.type !== 'digital') return <>{item.name}</>;
  return (
    <>
      {item.name}
      <br />
      <span style={{ fontWeight: 'normal', opacity: 0.7, fontSize: '0.82em' }}>
        (Digital Download)
      </span>
    </>
  );
}