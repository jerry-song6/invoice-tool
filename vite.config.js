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
  base: "./", // 关键：使用相对路径
  server: {
    port: 3000,
  },
});
