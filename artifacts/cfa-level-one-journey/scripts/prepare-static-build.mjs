import { copyFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDirectory = resolve(import.meta.dirname, '../dist/public');
const indexPath = resolve(outputDirectory, 'index.html');
const fallbackPath = resolve(outputDirectory, '404.html');

await access(indexPath);
await copyFile(indexPath, fallbackPath);
console.log('Created 404.html SPA fallback for static hosts.');
