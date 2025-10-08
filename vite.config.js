import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          ocr: ["tesseract.js"],
          excel: ["xlsx", "file-saver"],
        },
      },
    },
  },
  server: {
    port: 3000,
  },
});
