/**
 * hooks/useCart.ts
 * Convenience wrapper around cartStore with Product-aware helpers.
 * Spec ref: section 5.1 (Cart)
 *
 * Usage:
 *   const { items, total, count, addToCart, isInCart } = useCart();
 */

import { useCartStore, type CartItem } from '@/store/cartStore';
import type { Product } from '@/types';

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useCart() {
  const store = useCartStore();

  // ── addToCart ──────────────────────────────
  // Converts a Product into a CartItem and delegates to the store.
  // Consecutive calls for the same product increment quantity via addItem logic.

  function addToCart(product: Product, quantity = 1): void {
    const cartItem: Omit<CartItem, 'quantity'> = {
      productId:  product.id,
      name:       product.name,
      price:      product.price,
      currency:   product.currency,
      imageUrl:   product.images[0]?.url ?? '',
      sellerId:   product.sellerId,
      sellerName: '', // seller name is not on the Product type; populate at call site if needed
    };

    // addItem always adds 1 per call — call it `quantity` times for custom qty
    for (let i = 0; i < quantity; i++) {
      store.addItem(cartItem);
    }
  }

  // ── removeFromCart ─────────────────────────

  function removeFromCart(productId: string): void {
    store.removeItem(productId);
  }

  // ── updateQuantity ─────────────────────────
  // Passing 0 or negative removes the item entirely (store contract).

  function updateQuantity(productId: string, quantity: number): void {
    store.updateQuantity(productId, quantity);
  }

  // ── clearCart ──────────────────────────────

  function clearCart(): void {
    store.clearCart();
  }

  // ── isInCart ───────────────────────────────

  function isInCart(productId: string): boolean {
    return store.items.some((item) => item.productId === productId);
  }

  return {
    items:          store.items,
    total:          store.getTotalPrice(),
    count:          store.getTotalCount(),
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    isInCart,
  };
}
