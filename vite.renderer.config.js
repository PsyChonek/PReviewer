import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(async () => {
	const { default: tailwindcss } = await import("@tailwindcss/vite");

	return {
		plugins: [react(), tailwindcss()],
		root: "src",
		build: {
			outDir: "../.vite/renderer",
			target: "chrome123",
			sourcemap: false,
			rollupOptions: {
				input: path.resolve(__dirname, "src/index.html"),
			},
		},
		server: {
			port: 3002,
			strictPort: true,
		},
	};
});
