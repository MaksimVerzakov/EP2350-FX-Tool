import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import pkg from './package.json' with { type: 'json' };

function resolveAppVersion(): string {
  if (process.env.APP_VERSION) {
    return process.env.APP_VERSION.replace(/^v/, '');
  }
  try {
    const latestTag = execSync('git describe --tags --abbrev=0 --match "v[0-9]*"', {
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .toString()
      .trim();
    if (latestTag) return latestTag.replace(/^v/, '');
  } catch {
    // No git tags yet; fall back to package.json
  }
  return pkg.version;
}

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(resolveAppVersion())
  },
  server: {
    port: 3000,
    open: true,
    watch: {
      ignored: ['**/.worktrees/**']
    }
  }
});
