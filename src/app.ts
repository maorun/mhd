import type { Product } from './types.ts';
import { loadProducts, addProduct, deleteProduct } from './storage.ts';
import { requestNotificationPermission, checkAndNotify, getDaysUntilExpiry } from './notifications.ts';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getStatusClass(daysLeft: number): string {
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 3) return 'critical';
  if (daysLeft <= 7) return 'warning';
  return 'ok';
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
    container.innerHTML = '<p class="empty-hint">Noch keine Produkte eingetragen.</p>';
    return;
  }

  container.innerHTML = products
    .map((p: Product) => {
      const daysLeft = getDaysUntilExpiry(p.expiryDate);
      const statusClass = getStatusClass(daysLeft);
      const statusLabel = getStatusLabel(daysLeft);
      return `
      <div class="product-card ${statusClass}" data-id="${p.id}">
        <div class="product-info">
          <span class="product-name">${escapeHtml(p.name)}</span>
          <span class="product-date">MHD: ${formatDate(p.expiryDate)}</span>
          <span class="product-status">${statusLabel}</span>
        </div>
        <button class="btn-delete" data-id="${p.id}" aria-label="Produkt löschen">🗑️</button>
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
  // Set default date to today
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

async function setupNotificationButton(btn: HTMLButtonElement): Promise<void> {
  const updateBtn = (): void => {
    if (!('Notification' in window)) {
      btn.textContent = 'Benachrichtigungen nicht verfügbar';
      btn.disabled = true;
    } else if (Notification.permission === 'granted') {
      btn.textContent = '🔔 Benachrichtigungen aktiv';
      btn.classList.add('active');
      btn.disabled = true;
    } else if (Notification.permission === 'denied') {
      btn.textContent = '🚫 Benachrichtigungen blockiert';
      btn.classList.add('denied');
      btn.disabled = true;
    } else {
      btn.textContent = '🔔 Benachrichtigungen aktivieren';
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
    <header>
      <h1>🥛 MHD-Tracker</h1>
      <p class="subtitle">Produkte mit Mindesthaltbarkeitsdatum verwalten</p>
    </header>

    <main>
      <section class="notification-section">
        <button id="btn-notify" class="btn btn-notify">🔔 Benachrichtigungen aktivieren</button>
      </section>

      <section class="form-section">
        <h2>Produkt hinzufügen</h2>
        <form id="product-form" novalidate>
          <div class="form-group">
            <label for="product-name">Produktname</label>
            <input
              type="text"
              id="product-name"
              name="product-name"
              placeholder="z.B. Milch, Joghurt, Brot…"
              required
              maxlength="100"
              autocomplete="off"
            />
          </div>
          <div class="form-group">
            <label for="expiry-date">Mindesthaltbarkeitsdatum</label>
            <input
              type="date"
              id="expiry-date"
              name="expiry-date"
              required
            />
          </div>
          <div class="form-group">
            <label for="notify-days">Benachrichtigung (Tage vorher)</label>
            <input
              type="number"
              id="notify-days"
              name="notify-days"
              value="3"
              min="1"
              max="30"
              required
            />
          </div>
          <button type="submit" class="btn btn-add">➕ Hinzufügen</button>
        </form>
      </section>

      <section class="products-section">
        <h2>Meine Produkte</h2>
        <div id="product-list"></div>
      </section>
    </main>

    <footer>
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
