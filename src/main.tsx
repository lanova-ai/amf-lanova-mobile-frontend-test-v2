import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from './registerServiceWorker';

// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
  registerServiceWorker();
}

createRoot(document.getElementById("root")!).render(<App />);
