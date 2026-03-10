# MHD-Tracker

Eine **Progressive Web App (PWA)** zur Verwaltung von Produkten mit **Mindesthaltbarkeitsdatum (MHD)**.

## Features

- 📝 Produkte mit MHD eintragen
- 🔔 Browser-Benachrichtigungen kurz vor Ablauf des MHD
- 🟢🟡🟠🔴 Farbkodierte Statusanzeige pro Produkt
- 📱 Installierbar als PWA (Homescreen-Icon)
- 🔌 Offline-fähig dank Service Worker

## Schnellstart

```bash
npm install
npm run dev
```

Dann im Browser öffnen: `http://localhost:5173`

## Build

```bash
npm run build
npm run preview
```

## Technologien

- [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) für PWA-Support
- Web Notifications API
- localStorage für Datenpersistenz
