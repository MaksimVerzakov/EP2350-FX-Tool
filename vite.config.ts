import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const CANDIDATE_VOLUMES = [
  '/Volumes/TINGDISK',
  '/Volumes/FX-MIC DISK',
  '/Volumes/FX-MIC',
  '/Volumes/TING'
];

function ep2350MacOsBridgePlugin(): Plugin {
  const attachMiddleware = (middlewares: any) => {
    middlewares.use(async (req: any, res: any, next: any) => {
      const url: string = req.url || '';
      if (!url.startsWith('/api/ep2350/')) {
        return next();
      }

      // Enable CORS so even the hosted GitHub Pages app can talk to localhost:3000 if running
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      const fs = await import('fs');
      const path = await import('path');
      const childProcess = await import('child_process');

      const sendJson = (status: number, payload: any) => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(payload));
      };

      const findMountedVolume = (): string | null => {
        for (const vol of CANDIDATE_VOLUMES) {
          try {
            if (fs.existsSync(vol) && fs.statSync(vol).isDirectory()) {
              return vol;
            }
          } catch {
            // Ignore permission/stat error
          }
        }
        return null;
      };

      const mountPath = findMountedVolume();

      // 1. GET /api/ep2350/status
      if (url.startsWith('/api/ep2350/status') && req.method === 'GET') {
        if (!mountPath) {
          return sendJson(200, {
            bridgeAvailable: true,
            connected: false
          });
        }

        try {
          const entries = fs.readdirSync(mountPath);
          const files: Array<{ name: string; size: number; isWav: boolean; isHidden: boolean }> = [];
          let hasConfigJson = false;
          let configSize = 0;
          let configLastModified = 0;
          let clusterUsed = 0;

          for (const name of entries) {
            try {
              const full = path.join(mountPath, name);
              const st = fs.statSync(full);
              if (st.isFile()) {
                const isHidden = name.startsWith('.');
                const isWav = name.toLowerCase().endsWith('.wav');
                files.push({ name, size: st.size, isWav, isHidden });
                clusterUsed += Math.max(4096, Math.ceil(st.size / 4096) * 4096);
                if (name.toLowerCase() === 'config.json') {
                  hasConfigJson = true;
                  configSize = st.size;
                  configLastModified = st.mtimeMs;
                }
              } else if (st.isDirectory()) {
                clusterUsed += 4096;
              }
            } catch {
              // Skip unreadable entry
            }
          }

          let totalBytes = 1028096;
          let usedBytes = clusterUsed;
          let freeBytes = Math.max(0, totalBytes - usedBytes);

          try {
            const dfOut = childProcess.execSync(`df -k "${mountPath}"`, { encoding: 'utf8', timeout: 1500 });
            const lines = dfOut.trim().split('\n');
            if (lines.length >= 2) {
              const parts = lines[1].trim().split(/\s+/);
              if (parts.length >= 4) {
                const totalK = parseInt(parts[1], 10);
                const usedK = parseInt(parts[2], 10);
                const availK = parseInt(parts[3], 10);
                if (!isNaN(totalK) && totalK > 0) {
                  totalBytes = totalK * 1024;
                  usedBytes = usedK * 1024;
                  freeBytes = availK * 1024;
                }
              }
            }
          } catch {
            // Fallback to cluster calculation
          }

          let serialPort: string | undefined;
          try {
            const devEntries = fs.readdirSync('/dev');
            const modem = devEntries.find((d: string) => d.startsWith('cu.usbmodem'));
            if (modem) serialPort = `/dev/${modem}`;
          } catch {
            // Ignore
          }

          return sendJson(200, {
            bridgeAvailable: true,
            connected: true,
            volumeName: path.basename(mountPath),
            mountPath,
            usbProduct: 'TEENAGE ENGINEERING EP-2350',
            serialPort,
            totalBytes,
            usedBytes,
            freeBytes,
            hasConfigJson,
            configSize,
            configLastModified,
            files
          });
        } catch (err: any) {
          return sendJson(500, { bridgeAvailable: true, connected: false, error: err?.message });
        }
      }

      // 2. GET /api/ep2350/config
      if (url.startsWith('/api/ep2350/config') && req.method === 'GET') {
        if (!mountPath) {
          return sendJson(404, { ok: false, error: 'TINGDISK is not mounted on /Volumes/TINGDISK.' });
        }
        const cfgPath = path.join(mountPath, 'config.json');
        if (!fs.existsSync(cfgPath)) {
          return sendJson(404, { ok: false, error: 'config.json not found on TINGDISK.' });
        }
        try {
          const rawJson = fs.readFileSync(cfgPath, 'utf8');
          return sendJson(200, { ok: true, rawJson });
        } catch (err: any) {
          return sendJson(500, { ok: false, error: err?.message || 'Failed to read config.json' });
        }
      }

      // 3. POST /api/ep2350/config
      if (url.startsWith('/api/ep2350/config') && req.method === 'POST') {
        if (!mountPath) {
          return sendJson(404, { ok: false, error: 'TINGDISK is not mounted on /Volumes/TINGDISK.' });
        }
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const parsedBody = JSON.parse(body || '{}');
            const rawJson = parsedBody.rawJson;
            if (typeof rawJson !== 'string' || !rawJson.trim()) {
              return sendJson(400, { ok: false, error: 'Missing rawJson payload.' });
            }
            // Verify valid JSON syntax before writing to hardware flash
            JSON.parse(rawJson);

            const cfgPath = path.join(mountPath, 'config.json');
            fs.writeFileSync(cfgPath, rawJson, 'utf8');

            // Clean up macOS AppleDouble resource fork files (._config.json) to save FAT12 clusters
            try {
              const appleDouble = path.join(mountPath, '._config.json');
              if (fs.existsSync(appleDouble)) {
                fs.unlinkSync(appleDouble);
              }
              childProcess.execSync(`dot_clean -m "${mountPath}"`, { timeout: 1500 });
            } catch {
              // Ignore if dot_clean fails
            }

            try {
              childProcess.execSync('sync', { timeout: 1500 });
            } catch {
              // Ignore
            }

            return sendJson(200, { ok: true });
          } catch (err: any) {
            return sendJson(500, { ok: false, error: err?.message || 'Failed to write config.json' });
          }
        });
        return;
      }

      // 4. POST /api/ep2350/eject
      if (url.startsWith('/api/ep2350/eject') && req.method === 'POST') {
        if (!mountPath) {
          return sendJson(404, { ok: false, error: 'TINGDISK is already unmounted.' });
        }
        try {
          childProcess.execSync(`diskutil eject "${mountPath}"`, { encoding: 'utf8', timeout: 5000 });
          return sendJson(200, {
            ok: true,
            message: 'TINGDISK safely ejected! Press the button over USB-C and squeeze the handle to reboot your mic.'
          });
        } catch (err: any) {
          return sendJson(500, { ok: false, error: err?.message || 'Failed to eject TINGDISK via diskutil.' });
        }
      }

      return next();
    });
  };

  return {
    name: 'vite-plugin-ep2350-macos-bridge',
    configureServer(server) {
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachMiddleware(server.middlewares);
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), ep2350MacOsBridgePlugin()],
  server: {
    port: 3000,
    open: true
  }
});
