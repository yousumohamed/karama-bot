import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
  // No .env file — fall back to real environment variables.
}

export const TOKEN = process.env.DISCORD_TOKEN;
export const PREFIX = process.env.PREFIX || '?';
// Render sets PORT automatically for web services.
export const PORT = Number(process.env.PORT) || 3000;

export const MONGODB_URI = process.env.MONGODB_URI;
export const MONGODB_DB = process.env.MONGODB_DB || 'karaama-bot';

// Old local storage, only read once to import it into MongoDB.
export const DATA_DIR = path.join(ROOT, 'data');
export const IMAGES_DIR = path.join(DATA_DIR, 'images');

export const BRAND_COLOR = 0x5865f2;
