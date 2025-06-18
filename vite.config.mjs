import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  server: {
    https: {
      key: fs.readFileSync(path.resolve(__dirname, 'certificate.key')),
      cert: fs.readFileSync(path.resolve(__dirname, 'certificate.pem')),
    },
    port: 5173,
    host: '0.0.0.0',
  },
});