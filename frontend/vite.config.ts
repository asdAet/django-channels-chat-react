import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectRegister: null,
      registerType: "autoUpdate",
      devOptions: {
        enabled: false,
      },
      manifest: {
        name: "Devil",
        short_name: "Devil",
        start_url: "/",
        display: "standalone",
        background_color: "#0a1020",
        theme_color: "#0a1020",
        icons: [],
      },
    }),
  ],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
        changeOrigin: true,
        secure: false,
        rewriteWsOrigin: true,
        configure: (proxy) => {
          proxy.on("error", (error) => {
            const code = (error as NodeJS.ErrnoException).code;
            if (
              code === "ECONNABORTED" ||
              code === "ECONNRESET" ||
              code === "EPIPE"
            ) {
              return;
            }
            console.error("[vite][ws-proxy] unexpected error", error);
          });
        },
      },
    },
  },
});
