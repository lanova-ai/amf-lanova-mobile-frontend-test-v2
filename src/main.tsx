import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from './registerServiceWorker';
import { initHotjar } from './lib/hotjar';

// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
  registerServiceWorker();
}

// Initialize Hotjar for session recording & analytics
initHotjar();

createRoot(document.getElementById("root")!).render(<App />);
