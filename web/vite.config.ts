import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, type PluginOption } from 'vite';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { cp, mkdir, rm } from 'node:fs/promises';

const copyDemosPlugin = (): PluginOption => ({
  name: 'copy-demos',
  apply: 'build',
  async closeBundle() {
    const demosDir = path.resolve(__dirname, '../demos');
    if (!existsSync(demosDir)) return;
    const targetDir = path.resolve(__dirname, 'dist/demos');
    await rm(targetDir, { recursive: true, force: true });
    await mkdir(targetDir, { recursive: true });
    await cp(demosDir, targetDir, { recursive: true });
  }
});

export default defineConfig({
  plugins: [svelte(), copyDemosPlugin()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared/src')
    }
  }
});
