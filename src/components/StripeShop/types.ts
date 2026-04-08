/** Shared ShopItem type — imported by Shop, ProductDetail, and cart.ts */
export interface ShopItem {
    /** Unique identifier — must match the key in the server's PRICE_CATALOGUE. */
    id:           string;
    name:         string;
    description?: string;
    /** Price in the smallest currency unit (cents for USD/CHF/EUR). */
    price:        number;
    currency?:    string;
    /** Thumbnail image shown in the shop grid and cart drawer. */
    image?:       string;
    /** Maximum quantity the user can add to cart. Default: 99. */
    maxQuantity?: number;
    /** Optional path to a ProductDetail page, e.g. "/shop/ferret-plushie" */
    detailUrl?:   string;
    /**
     * Product type. "digital" renders a download badge on the card image.
     * Omit or set to "physical" for tangible goods.
     */
    type?:        'digital' | 'physical';
  }