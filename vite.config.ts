import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  optimizeDeps: {
    exclude: ["@huggingface/transformers"],
  },
  worker: {
    format: "es",
  },
});
