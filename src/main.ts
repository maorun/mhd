import './style.css';
import { initApp } from './app.ts';

const appEl = document.querySelector<HTMLDivElement>('#app');
if (appEl) {
  initApp(appEl).catch(console.error);
}
