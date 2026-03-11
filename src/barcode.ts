import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';

export interface BarcodeScanResult {
  barcode: string;
  productName: string | null;
}

async function lookupProductName(barcode: string): Promise<string | null> {
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (
      data !== null &&
      typeof data === 'object' &&
      'status' in data &&
      data.status === 1 &&
      'product' in data &&
      data.product !== null &&
      typeof data.product === 'object'
    ) {
      const product = data.product as Record<string, unknown>;
      const name =
        (typeof product['product_name_de'] === 'string' && product['product_name_de']) ||
        (typeof product['product_name'] === 'string' && product['product_name']) ||
        null;
      return name;
    }
  } catch {
    // Network error or parse error – silently ignore
  }
  return null;
}

export async function openBarcodeScanner(
  onResult: (result: BarcodeScanResult) => void,
  onClose: () => void,
): Promise<void> {
  const codeReader = new BrowserMultiFormatReader();

  // Build modal overlay
  const overlay = document.createElement('div');
  overlay.id = 'barcode-scanner-modal';
  overlay.className =
    'fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 px-4';

  overlay.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl w-full max-w-sm flex flex-col gap-3 overflow-hidden">
      <div class="flex items-center justify-between px-4 pt-4">
        <h3 class="text-base font-semibold text-gray-800">📷 Barcode scannen</h3>
        <button id="btn-scanner-close" aria-label="Scanner schließen" class="text-gray-400 hover:text-gray-700 text-2xl leading-none cursor-pointer bg-transparent border-0 transition-colors">&times;</button>
      </div>
      <p class="text-sm text-gray-500 px-4">Halte den Barcode des Produkts vor die Kamera.</p>
      <div class="relative bg-black w-full" style="aspect-ratio:4/3">
        <video id="barcode-video" class="w-full h-full object-cover" autoplay muted playsinline></video>
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div class="border-2 border-green-400 rounded w-3/4 h-1/3 opacity-70"></div>
        </div>
      </div>
      <p id="scanner-status" class="text-xs text-center text-gray-400 px-4 pb-4">Kamera wird gestartet…</p>
    </div>
  `;

  document.body.appendChild(overlay);

  const videoEl = overlay.querySelector<HTMLVideoElement>('#barcode-video')!;
  const statusEl = overlay.querySelector<HTMLParagraphElement>('#scanner-status')!;
  const closeBtnEl = overlay.querySelector<HTMLButtonElement>('#btn-scanner-close')!;

  let controls: IScannerControls | null = null;
  let stopped = false;

  const cleanup = (): void => {
    if (stopped) return;
    stopped = true;
    try {
      controls?.stop();
    } catch {
      // ignore
    }
    overlay.remove();
    onClose();
  };

  closeBtnEl.addEventListener('click', cleanup);
  overlay.addEventListener('click', (e: MouseEvent) => {
    if (e.target === overlay) cleanup();
  });

  try {
    controls = await codeReader.decodeFromVideoDevice(
      undefined,
      videoEl,
      async (result, err) => {
        if (stopped) return;
        if (result) {
          stopped = true;
          const barcode = result.getText();
          statusEl.textContent = '✅ Barcode erkannt – Produktname wird gesucht…';
          try {
            controls?.stop();
          } catch {
            // ignore
          }
          const productName = await lookupProductName(barcode);
          overlay.remove();
          onResult({ barcode, productName });
        } else if (err && !(err instanceof NotFoundException)) {
          // Only show unexpected errors, not "no barcode found yet"
          statusEl.textContent = 'Fehler beim Scannen. Bitte erneut versuchen.';
        }
      },
    );
    statusEl.textContent = 'Barcode vor die Kamera halten…';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    statusEl.textContent = `Kamera konnte nicht gestartet werden: ${message}`;
  }
}

