import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  resolve: {
    dedupe: ["react", "react-dom", "react-router", "react-router-dom"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (
              id.includes("/react/") ||
              id.includes("/react-dom/") ||
              id.includes("react/jsx-runtime")
            ) {
              return "react";
            }
            if (id.includes("@stackframe")) return "stackframe";
            if (id.includes("@radix-ui") || id.includes("cmdk")) {
              return "radix";
            }
            if (id.includes("react-router")) return "react-router";
            return "vendor";
          }
          return undefined;
        },
      },
    },
  },
});
