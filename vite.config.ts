import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: false,
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "tenderexpert-google-fonts-styles" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "tenderexpert-google-fonts-files",
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      includeAssets: ["tenderexpert-logo-hd.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "TenderExpert B2G CRM",
        short_name: "TenderExpert",
        description: "TenderExpert - B2G Intelligence and CRM Platform",
        theme_color: "#5842B8",
        background_color: "#5842B8",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        lang: "en-IN",
        categories: ["business", "productivity", "finance"],
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          { name: "Add Lead", short_name: "Add Lead", url: "/leads/new", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
          { name: "Payments", short_name: "Payments", url: "/orders", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
          { name: "Revenue Dashboard", short_name: "Revenue", url: "/", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
