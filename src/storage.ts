import type { Product } from './types.ts';

const STORAGE_KEY = 'mhd-products';

export function loadProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Product[];
  } catch {
    return [];
  }
}

export function saveProducts(products: Product[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

export function addProduct(product: Omit<Product, 'id' | 'notified'>): Product {
  const products = loadProducts();
  const newProduct: Product = {
    ...product,
    id: crypto.randomUUID(),
    notified: false,
  };
  products.push(newProduct);
  saveProducts(products);
  return newProduct;
}

export function deleteProduct(id: string): void {
  const products = loadProducts().filter((p) => p.id !== id);
  saveProducts(products);
}

export function markNotified(id: string): void {
  const products = loadProducts().map((p) =>
    p.id === id ? { ...p, notified: true } : p,
  );
  saveProducts(products);
}
