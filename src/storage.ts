import type { Product } from './types.ts';

const STORAGE_KEY = 'mhd-products';
export const DATA_CACHE = 'mhd-data-v1';
const CACHE_PRODUCTS_URL = '/mhd-data';
const CACHE_NOTIFIED_URL = '/mhd-notified';

export function loadProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Product[];
  } catch {
    return [];
  }
}

/** Writes the current product list to Cache Storage so the Service Worker can read it. */
function syncProductsToCache(products: Product[]): void {
  if (typeof caches === 'undefined') return;
  caches
    .open(DATA_CACHE)
    .then((cache) =>
      cache.put(
        new Request(CACHE_PRODUCTS_URL),
        new Response(JSON.stringify(products), { headers: { 'Content-Type': 'application/json' } }),
      ),
    )
    .catch(() => {});
}

export function saveProducts(products: Product[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  syncProductsToCache(products);
}

/**
 * Reads the list of product IDs notified by the Service Worker while the app
 * was closed and merges the `notified` flag back into localStorage.
 */
export async function syncSwNotifiedState(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(DATA_CACHE);
    const response = await cache.match(new Request(CACHE_NOTIFIED_URL));
    if (!response) return;
    const notifiedIds: string[] = await response.json();
    if (notifiedIds.length === 0) return;
    const products = loadProducts();
    let changed = false;
    const updated = products.map((p) => {
      if (!p.notified && notifiedIds.includes(p.id)) {
        changed = true;
        return { ...p, notified: true };
      }
      return p;
    });
    if (changed) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {
    // ignore – best-effort sync
  }
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

export function updateProduct(id: string, updates: Partial<Omit<Product, 'id'>>): void {
  const products = loadProducts().map((p) => {
    if (p.id !== id) return p;
    const updated = { ...p, ...updates };
    // Reset notified flag when expiry date or notification threshold changes
    if (updates.expiryDate !== undefined || updates.notifyDaysBefore !== undefined) {
      updated.notified = false;
    }
    return updated;
  });
  saveProducts(products);
}

export function markNotified(id: string): void {
  const products = loadProducts().map((p) =>
    p.id === id ? { ...p, notified: true } : p,
  );
  saveProducts(products);
}
