import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8000";

  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 5173,
      allowedHosts: ["admin.arcade.orfactor.com"],
      watch: {
        ignored: [
          "**/../api/storage/**",
          "**/../api/bootstrap/cache/**",
          "**/api/storage/**",
          "**/api/bootstrap/cache/**",
        ],
      },
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          assetFileNames: (assetInfo) => {
            if (
              /\.(png|jpe?g|gif|svg|webp|mp4|mp3|pdf|ttf|css|js|woff|woff2|eot|ico|webmanifest|json|map|webp|webm|weba)$/.test(
                assetInfo.name ?? ""
              )
            ) {
              return "assets/[name][extname]";
            }
            return "assets/[name]-[hash][extname]";
          },
        },
      },
    },
  };
});
