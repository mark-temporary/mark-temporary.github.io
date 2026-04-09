/** A single selectable variant of a product (e.g. colour + size combination). */
export interface ProductVariant {
    /** Unique Stripe-facing ID — must match PRICE_CATALOGUE in the backend. */
    id:       string;
    /** Label shown in the dropdown, e.g. "Red / S" or "Digital — MP3". */
    label:    string;
    /** Price in smallest currency unit, or decimal (e.g. 24.90). */
    price:    number;
    currency?: string;
  }
  
  /** Shared ShopItem type — imported by Shop, ProductDetail, and cart.ts */
  export interface ShopItem {
    /** Unique identifier — must match the key in the server's PRICE_CATALOGUE.
     *  For products with variants this is a stable display key only;
     *  each variant carries its own id that goes to Stripe. */
    id:           string;
    name:         string;
    description?: string;
    /** Price in the smallest currency unit (cents for USD/CHF/EUR).
     *  Ignored when variants are present — each variant has its own price. */
    price:        number;
    currency?:    string;
    /** Thumbnail image shown in the shop grid and cart drawer. */
    image?:       string;
    /** Maximum quantity the user can add to cart. Default: 99. */
    maxQuantity?: number;
    /** Optional path to a ProductDetail page, e.g. "/product-detail/tshirt" */
    detailUrl?:   string;
    /**
     * Product type. "digital" renders a download badge on the card image.
     * Omit or set to "physical" for tangible goods.
     */
    type?:        'digital' | 'physical';
    /**
     * Optional variant list. When present the product card and detail page
     * show a dropdown; the selected variant's id and price are used in the cart.
     */
    variants?:    ProductVariant[];
  }