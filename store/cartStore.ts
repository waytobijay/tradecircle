/**
 * store/cartStore.ts
 * Global cart state via Zustand.
 * Spec ref: section 5.1 (Cart)
 *
 * Usage:
 *   const { items, addItem, removeItem } = useCartStore()
 *   const total = useCartStore((s) => s.getTotalPrice())
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ProductCurrency } from '@/types';

// ─────────────────────────────────────────────
// CartItem type
// Represents a single line item in the cart.
// ─────────────────────────────────────────────

export interface CartItem {
  /** Firestore product document ID */
  productId: string;
  name: string;
  price: number;
  currency: ProductCurrency;
  /** Primary product image URL */
  imageUrl: string;
  sellerId: string;
  sellerName: string;
  quantity: number;
}

// ─────────────────────────────────────────────
// State shape
// ─────────────────────────────────────────────

interface CartState {
  items: CartItem[];
  /** Active currency — driven by admin config. Spec ref: section 5.3 */
  currency: ProductCurrency;
}

// ─────────────────────────────────────────────
// Actions shape
// ─────────────────────────────────────────────

interface CartActions {
  /**
   * Add a product to the cart.
   * If the product is already in the cart, increments quantity by 1.
   */
  addItem: (item: Omit<CartItem, 'quantity'>) => void;

  /** Remove a product from the cart entirely by productId. */
  removeItem: (productId: string) => void;

  /**
   * Set an item's quantity explicitly.
   * Passing quantity ≤ 0 removes the item.
   */
  updateQuantity: (productId: string, quantity: number) => void;

  /** Empty the cart — called after successful checkout. */
  clearCart: () => void;

  /** Set the active display currency. Spec ref: section 5.3 */
  setCurrency: (currency: ProductCurrency) => void;

  /** Total number of individual units across all line items. */
  getTotalCount: () => number;

  /**
   * Sum of (price × quantity) for all items.
   * Returns raw number — format with currencyFormatter util when displaying.
   */
  getTotalPrice: () => number;
}

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const useCartStore = create<CartState & CartActions>()(
  persist(
    (set, get) => ({
  // ── Initial state ──────────────────────────
  items:    [],
  currency: 'AUD',

  // ── Actions ────────────────────────────────

  addItem: (incomingItem) =>
    set((state) => {
      const existing = state.items.find(
        (i) => i.productId === incomingItem.productId
      );

      if (existing) {
        // Already in cart — increment quantity
        return {
          items: state.items.map((i) =>
            i.productId === incomingItem.productId
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
        };
      }

      // New item — add with quantity 1
      return {
        items: [...state.items, { ...incomingItem, quantity: 1 }],
      };
    }),

  removeItem: (productId) =>
    set((state) => ({
      items: state.items.filter((i) => i.productId !== productId),
    })),

  updateQuantity: (productId, quantity) =>
    set((state) => {
      if (quantity <= 0) {
        return {
          items: state.items.filter((i) => i.productId !== productId),
        };
      }
      return {
        items: state.items.map((i) =>
          i.productId === productId ? { ...i, quantity } : i
        ),
      };
    }),

  clearCart: () => set({ items: [] }),

  setCurrency: (currency) => set({ currency }),

  getTotalCount: () =>
    get().items.reduce((sum, item) => sum + item.quantity, 0),

  getTotalPrice: () =>
    get().items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    ),
    }),
    {
      name:    'tc-cart',
      storage: createJSONStorage(() => localStorage),
      // Only persist items and currency — derived getters are re-created by Zustand.
      partialize: (state) => ({ items: state.items, currency: state.currency }),
    }
  )
);
