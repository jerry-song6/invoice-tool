/*
 * @Author: Songjia3 Jia3.Song@cicc.com.cn
 * @Date: 2025-10-06 17:11:17
 * @LastEditors: Songjia3 Jia3.Song@cicc.com.cn
 * @LastEditTime: 2025-10-07 15:02:49
 * @Description: Do not edit
 */
// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  server: {
    port: 3000,
  },
});
