import { defineConfig } from "vite";

export default defineConfig({
    server: {
        cors: {
            origin: "https://www.owlbear.rodeo"
        }
    },
    build: {
        rollupOptions: {
            input: {
                main: "index.html",
                preview: "preview.html"
            }
        }
    }
});