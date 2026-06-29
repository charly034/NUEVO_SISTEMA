import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

const devCacheBust = Date.now().toString(36);

function devSourceCacheBust() {
  return {
    name: "la-quinta-dev-source-cache-bust",
    apply: "serve",
    transform(code, id) {
      if (!id.includes("/src/") || !/\.[cm]?[jt]sx?(?:\?.*)?$/.test(id)) {
        return null;
      }

      const appendBust = (specifier) => {
        if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
          return specifier;
        }
        return specifier.includes("?")
          ? `${specifier}&codex_v=${devCacheBust}`
          : `${specifier}?codex_v=${devCacheBust}`;
      };

      return code
        .replace(/(\bfrom\s*["'])(\.{1,2}\/[^"']+)(["'])/g, (_, prefix, specifier, suffix) => (
          `${prefix}${appendBust(specifier)}${suffix}`
        ))
        .replace(/(\bimport\s*\(\s*["'])(\.{1,2}\/[^"']+)(["']\s*\))/g, (_, prefix, specifier, suffix) => (
          `${prefix}${appendBust(specifier)}${suffix}`
        ));
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [devSourceCacheBust(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client", "@tanstack/react-query"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/tests/setup.js",
    testTimeout: 15000,
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5175,
    strictPort: true,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
    allowedHosts: [".ngrok-free.app", ".ngrok-free.dev", ".ngrok.io", ".laquintacomidas.com"],
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
