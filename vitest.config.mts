import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        // Las pruebas del backend usan node:test y el emulador por separado.
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        environment: 'jsdom',
        globals: true,
        setupFiles: [], // Add setup files here if needed later
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
