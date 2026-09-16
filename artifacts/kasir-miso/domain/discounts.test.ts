import { describe, expect, it } from 'vitest';
import { calculateDiscount, calculateDiscountedTotal } from './discounts';

describe('discounts', () => {
  it('calculates percentage discounts and clamps them to the subtotal', () => {
    expect(calculateDiscount(100_000, 'percent', 10)).toBe(10_000);
    expect(calculateDiscount(100_000, 'percent', 150)).toBe(100_000);
  });

  it('calculates fixed discounts and never produces a negative total', () => {
    expect(calculateDiscountedTotal(100_000, 'amount', 15_000)).toBe(85_000);
    expect(calculateDiscountedTotal(100_000, 'amount', 150_000)).toBe(0);
  });
});