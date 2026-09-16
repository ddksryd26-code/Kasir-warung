import type { DiscountType } from '@/context/WarungContext';

export function calculateDiscount(subtotal: number, type: DiscountType, value: number) {
  if (type === 'percent') return Math.min(subtotal, Math.max(0, Math.round(subtotal * Math.min(100, Math.max(0, value)) / 100)));
  if (type === 'amount') return Math.min(subtotal, Math.max(0, Math.round(value)));
  return 0;
}

export function calculateDiscountedTotal(subtotal: number, type: DiscountType, value: number) {
  return Math.max(0, subtotal - calculateDiscount(subtotal, type, value));
}