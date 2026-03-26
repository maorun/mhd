import { describe, it, expect, beforeEach } from 'vitest';
import { loadProducts, saveProducts, addProduct, deleteProduct, updateProduct, markNotified } from './storage.ts';

const STORAGE_KEY = 'mhd-products';

beforeEach(() => {
  localStorage.clear();
});

describe('loadProducts', () => {
  it('returns empty array when nothing is stored', () => {
    expect(loadProducts()).toEqual([]);
  });

  it('returns stored products', () => {
    const products = [{ id: '1', name: 'Milk', expiryDate: '2026-04-01', notifyDaysBefore: 3, notified: false }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    expect(loadProducts()).toEqual(products);
  });

  it('returns empty array when stored value is invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json');
    expect(loadProducts()).toEqual([]);
  });
});

describe('saveProducts', () => {
  it('saves products to localStorage', () => {
    const products = [{ id: '1', name: 'Eggs', expiryDate: '2026-05-01', notifyDaysBefore: 2, notified: false }];
    saveProducts(products);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(products));
  });
});

describe('addProduct', () => {
  it('adds a product with a generated id and notified=false', () => {
    const result = addProduct({ name: 'Butter', expiryDate: '2026-06-01', notifyDaysBefore: 5 });
    expect(result.name).toBe('Butter');
    expect(result.expiryDate).toBe('2026-06-01');
    expect(result.notifyDaysBefore).toBe(5);
    expect(result.notified).toBe(false);
    expect(typeof result.id).toBe('string');
    expect(result.id.length).toBeGreaterThan(0);
  });

  it('persists the product to localStorage', () => {
    addProduct({ name: 'Cheese', expiryDate: '2026-07-01', notifyDaysBefore: 7 });
    const stored = loadProducts();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.name).toBe('Cheese');
  });

  it('appends to existing products', () => {
    addProduct({ name: 'Milk', expiryDate: '2026-04-01', notifyDaysBefore: 3 });
    addProduct({ name: 'Eggs', expiryDate: '2026-05-01', notifyDaysBefore: 2 });
    expect(loadProducts()).toHaveLength(2);
  });
});

describe('deleteProduct', () => {
  it('removes the product with the given id', () => {
    const p = addProduct({ name: 'Yogurt', expiryDate: '2026-04-15', notifyDaysBefore: 2 });
    deleteProduct(p.id);
    expect(loadProducts()).toHaveLength(0);
  });

  it('leaves other products intact', () => {
    const p1 = addProduct({ name: 'Milk', expiryDate: '2026-04-01', notifyDaysBefore: 3 });
    const p2 = addProduct({ name: 'Eggs', expiryDate: '2026-05-01', notifyDaysBefore: 2 });
    deleteProduct(p1.id);
    const remaining = loadProducts();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.id).toBe(p2.id);
  });

  it('does nothing when id does not exist', () => {
    addProduct({ name: 'Milk', expiryDate: '2026-04-01', notifyDaysBefore: 3 });
    deleteProduct('nonexistent-id');
    expect(loadProducts()).toHaveLength(1);
  });
});

describe('updateProduct', () => {
  it('updates the specified fields', () => {
    const p = addProduct({ name: 'Milk', expiryDate: '2026-04-01', notifyDaysBefore: 3 });
    updateProduct(p.id, { name: 'Oat Milk' });
    const updated = loadProducts().find((x) => x.id === p.id);
    expect(updated?.name).toBe('Oat Milk');
  });

  it('resets notified when expiryDate changes', () => {
    const p = addProduct({ name: 'Milk', expiryDate: '2026-04-01', notifyDaysBefore: 3 });
    markNotified(p.id);
    updateProduct(p.id, { expiryDate: '2026-05-01' });
    const updated = loadProducts().find((x) => x.id === p.id);
    expect(updated?.notified).toBe(false);
  });

  it('resets notified when notifyDaysBefore changes', () => {
    const p = addProduct({ name: 'Milk', expiryDate: '2026-04-01', notifyDaysBefore: 3 });
    markNotified(p.id);
    updateProduct(p.id, { notifyDaysBefore: 7 });
    const updated = loadProducts().find((x) => x.id === p.id);
    expect(updated?.notified).toBe(false);
  });

  it('does not reset notified when only name changes', () => {
    const p = addProduct({ name: 'Milk', expiryDate: '2026-04-01', notifyDaysBefore: 3 });
    markNotified(p.id);
    updateProduct(p.id, { name: 'Oat Milk' });
    const updated = loadProducts().find((x) => x.id === p.id);
    expect(updated?.notified).toBe(true);
  });
});

describe('markNotified', () => {
  it('sets notified to true for the given id', () => {
    const p = addProduct({ name: 'Milk', expiryDate: '2026-04-01', notifyDaysBefore: 3 });
    expect(loadProducts()[0]!.notified).toBe(false);
    markNotified(p.id);
    expect(loadProducts()[0]!.notified).toBe(true);
  });

  it('does not affect other products', () => {
    const p1 = addProduct({ name: 'Milk', expiryDate: '2026-04-01', notifyDaysBefore: 3 });
    addProduct({ name: 'Eggs', expiryDate: '2026-05-01', notifyDaysBefore: 2 });
    markNotified(p1.id);
    const products = loadProducts();
    expect(products.find((x) => x.id === p1.id)?.notified).toBe(true);
    expect(products.find((x) => x.name === 'Eggs')?.notified).toBe(false);
  });
});
