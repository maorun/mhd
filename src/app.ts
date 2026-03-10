import type { Product } from './types.ts';
import { loadProducts, addProduct, deleteProduct } from './storage.ts';
import { requestNotificationPermission, checkAndNotify, getDaysUntilExpiry } from './notifications.ts';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Returns complete Tailwind class strings so the scanner can detect them statically
function getCardClasses(daysLeft: number): string {
  const base = 'flex items-center justify-between px-4 py-3.5 rounded-lg mb-2.5 border-l-4 last:mb-0 shadow-sm';
  if (daysLeft < 0) return `${base} border-l-red-800 bg-red-50`;
  if (daysLeft <= 3) return `${base} border-l-orange-600 bg-orange-50`;
  if (daysLeft <= 7) return `${base} border-l-amber-400 bg-amber-50`;
  return `${base} border-l-green-500 bg-gray-50`;
}

function getStatusTextClass(daysLeft: number): string {
  if (daysLeft < 0) return 'text-xs font-medium text-red-800';
  if (daysLeft <= 3) return 'text-xs font-medium text-orange-600';
  if (daysLeft <= 7) return 'text-xs font-medium text-amber-500';
  return 'text-xs font-medium text-green-600';
}

function getStatusLabel(daysLeft: number): string {
  if (daysLeft < 0) return `Abgelaufen vor ${Math.abs(daysLeft)} Tag(en)`;
  if (daysLeft === 0) return 'Läuft heute ab!';
  if (daysLeft === 1) return 'Läuft morgen ab!';
  return `Noch ${daysLeft} Tage`;
}

function renderProductList(container: HTMLElement): void {
  const products = loadProducts();
  products.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  if (products.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Noch keine Produkte eingetragen.</p>';
    return;
  }

  container.innerHTML = products
    .map((p: Product) => {
      const daysLeft = getDaysUntilExpiry(p.expiryDate);
      const cardClasses = getCardClasses(daysLeft);
      const statusTextClass = getStatusTextClass(daysLeft);
      const statusLabel = getStatusLabel(daysLeft);
      return `
      <div class="${cardClasses}" data-id="${p.id}">
        <div class="flex flex-col gap-0.5">
          <span class="font-semibold text-base text-gray-800">${escapeHtml(p.name)}</span>
          <span class="text-xs text-gray-400">MHD: ${formatDate(p.expiryDate)}</span>
          <span class="${statusTextClass}">${statusLabel}</span>
        </div>
        <button class="bg-transparent border-0 cursor-pointer text-xl px-2 py-1 rounded-lg hover:bg-red-100 shrink-0 transition-colors btn-delete" data-id="${p.id}" aria-label="Produkt löschen">🗑️</button>
      </div>`;
    })
    .join('');

  container.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset['id'];
      if (id) {
        deleteProduct(id);
        renderProductList(container);
      }
    });
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setupForm(form: HTMLFormElement, productList: HTMLElement): void {
  const dateInput = form.querySelector<HTMLInputElement>('#expiry-date');
  const today = new Date().toISOString().split('T')[0];
  if (dateInput) dateInput.min = today;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nameInput = form.querySelector<HTMLInputElement>('#product-name');
    const notifyInput = form.querySelector<HTMLInputElement>('#notify-days');

    const name = nameInput?.value.trim() ?? '';
    const expiryDate = dateInput?.value ?? '';
    const notifyDaysBefore = parseInt(notifyInput?.value ?? '3', 10);

    if (!name || !expiryDate) return;

    addProduct({ name, expiryDate, notifyDaysBefore });
    form.reset();
    if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];
    renderProductList(productList);
    checkAndNotify();
  });
}

const BASE_NOTIFY_BTN = 'inline-flex items-center justify-center gap-1.5 px-6 py-2 rounded-lg text-[0.95rem] font-semibold cursor-pointer transition-colors border-2 disabled:cursor-not-allowed disabled:opacity-70';

async function setupNotificationButton(btn: HTMLButtonElement): Promise<void> {
  const updateBtn = (): void => {
    if (!('Notification' in window)) {
      btn.textContent = 'Benachrichtigungen nicht verfügbar';
      btn.className = `${BASE_NOTIFY_BTN} bg-gray-100 text-gray-500 border-gray-300`;
      btn.disabled = true;
    } else if (Notification.permission === 'granted') {
      btn.textContent = '🔔 Benachrichtigungen aktiv';
      btn.className = `${BASE_NOTIFY_BTN} bg-green-600 text-white border-green-600`;
      btn.disabled = true;
    } else if (Notification.permission === 'denied') {
      btn.textContent = '🚫 Benachrichtigungen blockiert';
      btn.className = `${BASE_NOTIFY_BTN} bg-gray-100 text-gray-500 border-gray-300`;
      btn.disabled = true;
    } else {
      btn.textContent = '🔔 Benachrichtigungen aktivieren';
      btn.className = `${BASE_NOTIFY_BTN} bg-white text-green-800 border-green-500 hover:bg-green-600 hover:text-white hover:border-green-600`;
      btn.disabled = false;
    }
  };

  updateBtn();

  btn.addEventListener('click', async () => {
    const permission = await requestNotificationPermission();
    if (permission === 'granted') {
      checkAndNotify();
    }
    updateBtn();
  });
}

export async function initApp(appElement: HTMLElement): Promise<void> {
  appElement.innerHTML = `
    <header class="bg-green-600 text-white px-4 pt-5 pb-4 text-center shadow-md">
      <h1 class="text-3xl font-bold">🥛 MHD-Tracker</h1>
      <p class="text-sm opacity-85 mt-1">Produkte mit Mindesthaltbarkeitsdatum verwalten</p>
    </header>

    <main class="flex-1 max-w-screen-sm w-full mx-auto px-4 py-4 flex flex-col gap-5">
      <section class="text-center">
        <button id="btn-notify" class="${BASE_NOTIFY_BTN} bg-white text-green-800 border-green-500 hover:bg-green-600 hover:text-white hover:border-green-600">🔔 Benachrichtigungen aktivieren</button>
      </section>

      <section class="bg-white rounded-lg p-5 shadow">
        <h2 class="text-base font-semibold mb-4 text-green-800">Produkt hinzufügen</h2>
        <form id="product-form" novalidate>
          <div class="flex flex-col gap-1 mb-3.5">
            <label for="product-name" class="text-sm font-medium text-gray-500">Produktname</label>
            <input
              type="text"
              id="product-name"
              name="product-name"
              placeholder="z.B. Milch, Joghurt, Brot…"
              required
              maxlength="100"
              autocomplete="off"
              class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base focus:outline-none focus:border-green-500 transition-colors"
            />
          </div>
          <div class="flex flex-col gap-1 mb-3.5">
            <label for="expiry-date" class="text-sm font-medium text-gray-500">Mindesthaltbarkeitsdatum</label>
            <input
              type="date"
              id="expiry-date"
              name="expiry-date"
              required
              class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base focus:outline-none focus:border-green-500 transition-colors"
            />
          </div>
          <div class="flex flex-col gap-1 mb-3.5">
            <label for="notify-days" class="text-sm font-medium text-gray-500">Benachrichtigung (Tage vorher)</label>
            <input
              type="number"
              id="notify-days"
              name="notify-days"
              value="3"
              min="1"
              max="30"
              required
              class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base focus:outline-none focus:border-green-500 transition-colors"
            />
          </div>
          <button type="submit" class="w-full bg-green-600 text-white mt-1 px-5 py-2.5 rounded-lg text-[0.95rem] font-semibold cursor-pointer hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70 transition-colors">➕ Hinzufügen</button>
        </form>
      </section>

      <section class="bg-white rounded-lg p-5 shadow">
        <h2 class="text-base font-semibold mb-4 text-green-800">Meine Produkte</h2>
        <div id="product-list"></div>
      </section>
    </main>

    <footer class="text-center py-3.5 px-4 text-xs text-gray-400 border-t border-gray-200 bg-white">
      <p>MHD-Tracker – Lebensmittel rechtzeitig aufbrauchen</p>
    </footer>
  `;

  const form = appElement.querySelector<HTMLFormElement>('#product-form')!;
  const productList = appElement.querySelector<HTMLElement>('#product-list')!;
  const notifyBtn = appElement.querySelector<HTMLButtonElement>('#btn-notify')!;

  setupForm(form, productList);
  await setupNotificationButton(notifyBtn);
  renderProductList(productList);

  // Check for expiring products on startup
  checkAndNotify();

  // Re-check every hour
  setInterval(checkAndNotify, 60 * 60 * 1000);
}
