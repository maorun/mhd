# Copilot Instructions – MHD-Tracker PWA

## Projektübersicht

**MHD-Tracker** ist eine Progressive Web App (PWA) entwickelt mit **TypeScript** und **Vite**.  
Die App ermöglicht es, Lebensmittelprodukte mit ihrem **Mindesthaltbarkeitsdatum (MHD)** einzutragen und erhält rechtzeitig **Browser-Benachrichtigungen**, bevor Produkte ablaufen.

---

## Technologie-Stack

| Technologie        | Zweck                                           |
|--------------------|------------------------------------------------|
| TypeScript 5        | Typsichere Entwicklung                         |
| Vite 7              | Build-Tool und Dev-Server                      |
| Tailwind CSS v4     | Utility-first Styling via `@tailwindcss/vite`  |
| vite-plugin-pwa     | PWA-Integration (Service Worker, Manifest)     |
| Web Notifications API | Browser-Benachrichtigungen                  |
| localStorage        | Datenpersistenz (clientseitig)                 |
| Service Worker      | Offline-Unterstützung, Hintergrund-Checks      |

---

## Projektstruktur

```
mhd/
├── public/
│   └── icons/             # PWA-Icons (72×72 bis 512×512 PNG)
├── src/
│   ├── main.ts            # Einstiegspunkt – initialisiert die App
│   ├── app.ts             # UI-Rendering, Formular-Logik, Produkt-Liste
│   ├── storage.ts         # localStorage-Zugriff (CRUD für Produkte)
│   ├── notifications.ts   # Web Notifications API, MHD-Prüflogik
│   ├── sw.ts              # Service Worker (Caching, Offline, Sync)
│   ├── types.ts           # TypeScript-Interfaces (Product)
│   └── style.css          # Globale Styles
├── index.html             # HTML-Einstiegspunkt
├── vite.config.ts         # Vite + PWA-Konfiguration
├── tsconfig.json          # TypeScript-Konfiguration
└── package.json           # Abhängigkeiten und Scripts
```

---

## Entwicklungsumgebung

```bash
# Abhängigkeiten installieren
npm install

# Entwicklungsserver starten (mit Hot Module Replacement)
npm run dev

# Produktions-Build erstellen
npm run build

# Build-Vorschau lokal testen
npm run preview
```

---

## Datenmodell

### `Product` Interface (`src/types.ts`)

```typescript
interface Product {
  id: string;            // Eindeutige ID (crypto.randomUUID())
  name: string;          // Produktname (max. 100 Zeichen)
  expiryDate: string;    // MHD als ISO-Datumsstring (YYYY-MM-DD)
  notifyDaysBefore: number; // Tage vor MHD für Benachrichtigung (1–30)
  notified: boolean;     // Wurde Benachrichtigung bereits gesendet?
}
```

---

## Kernfunktionen

### Produkt hinzufügen
- Eingabe: Produktname, MHD-Datum, Anzahl Tage vor Ablauf für Benachrichtigung
- Validierung: Pflichtfelder, Textlänge ≤ 100 Zeichen, Ganzzahl 1–30
- Persistenz: `localStorage` via `src/storage.ts`

### Produkt-Liste
- Sortierung nach MHD (frühestes zuerst)
- Farbkodierung:
  - 🟢 **Grün** (`ok`): Mehr als 7 Tage verbleibend
  - 🟡 **Gelb** (`warning`): 4–7 Tage verbleibend
  - 🟠 **Orange** (`critical`): 1–3 Tage verbleibend
  - 🔴 **Rot** (`expired`): MHD abgelaufen

### Benachrichtigungen
- Browser-Benachrichtigungen via **Web Notifications API**
- Benutzer muss Erlaubnis erteilen (Klick auf „🔔 Benachrichtigungen aktivieren")
- Benachrichtigung wird einmalig gesendet (Flag `notified` in localStorage)
- Check bei App-Start und alle 60 Minuten (`setInterval`)

### PWA / Offline
- Service Worker cacht alle Assets (Cache-First-Strategie)
- Offline-Fallback auf `index.html`
- `manifest.webmanifest` für Installation auf dem Homescreen

---

## Coding-Konventionen

### TypeScript
- **Strict Mode**: alle `tsconfig.json`-Strict-Optionen aktiviert
- Keine `any`-Typen (außer wo unvermeidlich, z.B. Service Worker APIs)
- Explizite Rückgabetypen bei allen Funktionen
- Imports mit `.ts`-Erweiterung (Vite-Bundler-Modus)

### HTML-Sicherheit
- Benutzereingaben werden immer mit `escapeHtml()` (in `app.ts`) bereinigt
- Kein `innerHTML` mit rohen Benutzerdaten

### CSS / Styling
- **Tailwind CSS v4** via `@tailwindcss/vite` Vite-Plugin – kein `tailwind.config.js` nötig
- Einstiegspunkt: `src/style.css` mit `@import "tailwindcss";` und optionalem `@theme { … }` für Custom-Tokens
- Alle Styles werden als Utility-Klassen direkt in den HTML-Templates in `src/app.ts` vergeben
- Dynamisch gebaute Klassen (z.B. Statusfarben) werden als **vollständige Strings** zurückgegeben, damit Tailwind sie beim Scan erkennt
- Mobile-first, maximal `max-w-screen-sm` (640 px) Breite für den Hauptinhalt

### Commits
- Konventionelle Commits: `feat:`, `fix:`, `style:`, `refactor:`, `docs:`

---

## Neue Features hinzufügen

### Neues Produkt-Feld
1. Typ in `src/types.ts` ergänzen
2. Formularfeld in `src/app.ts` (HTML-Template und Formular-Handler)
3. Speicherlogik in `src/storage.ts` prüfen (wird automatisch serialisiert)

### Neue Benachrichtigungslogik
- `src/notifications.ts` editieren
- `checkAndNotify()` erweitern
- Service Worker (`src/sw.ts`) für Hintergrund-Push ggf. anpassen

### Icons aktualisieren
- PNG-Dateien in `public/icons/` ersetzen
- Größen: 72, 96, 128, 144, 152, 192, 384, 512 Pixel
- Manifest-Einträge in `vite.config.ts` prüfen

---

## Tests

Aktuell keine automatisierten Tests vorhanden. Bei Bedarf:
- **Unit-Tests**: Vitest + jsdom für Logik in `storage.ts` und `notifications.ts`
- **E2E-Tests**: Playwright für UI-Flows

---

## Bekannte Einschränkungen

- **localStorage**: Daten sind gerätespezifisch, keine Cloud-Synchronisation
- **Benachrichtigungen**: Benachrichtigungen werden nur gesendet, wenn die App geöffnet ist (Web Notifications API Einschränkung ohne Push-Server)
- **iOS Safari**: Eingeschränkte PWA-Unterstützung (Benachrichtigungen ggf. nicht verfügbar)
