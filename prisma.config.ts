import { defineConfig } from '@prisma/config';

try {
  process.loadEnvFile();
} catch (e) {
  // Ignored if .env doesn't exist
}

export default defineConfig({
  datasource: {
    // Falls back to DIRECT_URL for CLI migration commands
    url: process.env.DIRECT_URL || process.env.DATABASE_URL!,
    directUrl: process.env.DIRECT_URL,
  },
});