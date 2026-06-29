import { defineConfig, loadEnv } from "vite";

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [devSourceCacheBust()],
    resolve: {
      dedupe: ["react", "react-dom", "@tanstack/react-query"],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client", "@tanstack/react-query"],
    },
    server: {
      host: "127.0.0.1",
      port: parseInt(env.PORT || "5174", 10),
      strictPort: false,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
      allowedHosts: [".ngrok-free.app", ".ngrok-free.dev", ".ngrok.io", ".laquintacomidas.com"],
      proxy: {
        "/api": {
          target: env.VITE_API_PROXY_TARGET || "http://localhost:3000",
          changeOrigin: true,
        },
      },
    },
  };
});
