import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: false, // Disables source maps so hackers cannot see original TypeScript files
    minify: "esbuild",
  },
  esbuild: {
    drop: ["console", "debugger"], // Removes all console.log and debugger statements
    legalComments: "none", // Strips out all comments
  },
}));
