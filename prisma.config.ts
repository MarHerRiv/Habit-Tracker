import { defineConfig } from '@prisma/config';

try {
  process.loadEnvFile();
} catch (e) {
}

export default defineConfig({
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  },
});