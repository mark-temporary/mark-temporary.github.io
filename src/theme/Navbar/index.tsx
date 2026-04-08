import React, {type ReactNode} from 'react';
import NavbarLayout from '@theme/Navbar/Layout';
import NavbarContent from '@theme/Navbar/Content';
import CartWidget from '@site/src/components/StripeShop/CartWidget';

export default function Navbar(): ReactNode {
  return (
    <NavbarLayout>
      <NavbarContent />
      <CartWidget />
    </NavbarLayout>
  );
}
