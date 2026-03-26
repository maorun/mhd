import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.mock is hoisted before imports – factory must not reference outer variables
vi.mock('./storage.ts', () => ({
  loadProducts: vi.fn(),
  markNotified: vi.fn(),
}));

import { getDaysUntilExpiry, checkAndNotify } from './notifications.ts';
import { loadProducts, markNotified } from './storage.ts';

// ── helpers ──────────────────────────────────────────────────────────────────

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0]!;
}

// ── getDaysUntilExpiry ────────────────────────────────────────────────────────

describe('getDaysUntilExpiry', () => {
  it('returns 0 for today', () => {
    expect(getDaysUntilExpiry(dateOffset(0))).toBe(0);
  });

  it('returns positive value for a future date', () => {
    expect(getDaysUntilExpiry(dateOffset(5))).toBe(5);
  });

  it('returns negative value for a past date', () => {
    expect(getDaysUntilExpiry(dateOffset(-3))).toBe(-3);
  });

  it('returns 1 for tomorrow', () => {
    expect(getDaysUntilExpiry(dateOffset(1))).toBe(1);
  });
});

// ── checkAndNotify ────────────────────────────────────────────────────────────

describe('checkAndNotify', () => {
  let NotificationMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();

    NotificationMock = vi.fn();
    Object.defineProperty(NotificationMock, 'permission', {
      value: 'granted',
      writable: true,
      configurable: true,
    });
    vi.stubGlobal('Notification', NotificationMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does nothing when Notification.permission is not granted', () => {
    Object.defineProperty(globalThis.Notification, 'permission', { value: 'denied', configurable: true });
    vi.mocked(loadProducts).mockReturnValue([
      { id: 'abc', name: 'Milk', expiryDate: dateOffset(2), notifyDaysBefore: 3, notified: false },
    ]);
    checkAndNotify();
    expect(NotificationMock).not.toHaveBeenCalled();
    expect(vi.mocked(markNotified)).not.toHaveBeenCalled();
  });

  it('sends notification and marks notified when product is within threshold', () => {
    vi.mocked(loadProducts).mockReturnValue([
      { id: 'abc', name: 'Milk', expiryDate: dateOffset(2), notifyDaysBefore: 3, notified: false },
    ]);
    checkAndNotify();
    expect(NotificationMock).toHaveBeenCalledOnce();
    expect(vi.mocked(markNotified)).toHaveBeenCalledWith('abc');
  });

  it('does not notify when product is outside the threshold', () => {
    vi.mocked(loadProducts).mockReturnValue([
      { id: 'xyz', name: 'Cheese', expiryDate: dateOffset(10), notifyDaysBefore: 3, notified: false },
    ]);
    checkAndNotify();
    expect(NotificationMock).not.toHaveBeenCalled();
    expect(vi.mocked(markNotified)).not.toHaveBeenCalled();
  });

  it('does not notify when product is already marked as notified', () => {
    vi.mocked(loadProducts).mockReturnValue([
      { id: 'def', name: 'Eggs', expiryDate: dateOffset(1), notifyDaysBefore: 3, notified: true },
    ]);
    checkAndNotify();
    expect(NotificationMock).not.toHaveBeenCalled();
    expect(vi.mocked(markNotified)).not.toHaveBeenCalled();
  });

  it('sends notification with expired label when product MHD has passed', () => {
    vi.mocked(loadProducts).mockReturnValue([
      { id: 'exp', name: 'Old Milk', expiryDate: dateOffset(-1), notifyDaysBefore: 3, notified: false },
    ]);
    checkAndNotify();
    expect(NotificationMock).toHaveBeenCalledOnce();
    const [title] = NotificationMock.mock.calls[0] as [string, NotificationOptions];
    expect(title).toContain('abgelaufen');
  });
});
