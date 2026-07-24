import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAPS_DIR = path.join(__dirname, 'public', 'maps');
const CHARS_DIR = path.join(__dirname, 'public', 'characters');
const HITBOX_FILE = path.join(CHARS_DIR, 'hitboxes.json');

// Vite plugin: Map Editor API endpoints
function mapEditorApiPlugin() {
  return {
    name: 'map-editor-api',
    configureServer(server) {
      // GET /api/maps/list — list all PNG maps
      server.middlewares.use('/api/maps/list', (req, res) => {
        try {
          const files = fs.readdirSync(MAPS_DIR);
          const maps = files
            .filter(f => f.endsWith('.png'))
            .map(f => ({
              name: f.replace('.png', ''),
              png: `/maps/${f}`,
              json: `/maps/${f.replace('.png', '_collisions.json')}`,
              hasCollision: files.includes(f.replace('.png', '_collisions.json'))
            }));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(maps));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });

      // POST /api/maps/save — save collision JSON for a map
      server.middlewares.use('/api/maps/save', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        let body = '';
        req.on('data', d => body += d);
        req.on('end', () => {
          try {
            const { mapName, data } = JSON.parse(body);
            if (!mapName || !data) throw new Error('Missing mapName or data');
            const safe = path.basename(mapName).replace(/[^a-zA-Z0-9_-]/g, '');
            const filePath = path.join(MAPS_DIR, `${safe}_collisions.json`);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, saved: `${safe}_collisions.json` }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });

      // POST /api/maps/upload — upload a new PNG map (base64)
      server.middlewares.use('/api/maps/upload', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        let body = '';
        req.on('data', d => body += d);
        req.on('end', () => {
          try {
            const { filename, base64 } = JSON.parse(body);
            if (!filename || !base64) throw new Error('Missing filename or base64');
            const safeName = path.basename(filename).replace(/[^a-zA-Z0-9_-]/g, '');
            const safe = safeName.endsWith('.png') ? safeName : safeName + '.png';
            const filePath = path.join(MAPS_DIR, safe);
            const buf = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            fs.writeFileSync(filePath, buf);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, path: `/maps/${safe}`, name: safe.replace('.png', '') }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });

      // POST /api/hitbox/save — save hitbox config for all characters
      server.middlewares.use('/api/hitbox/save', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        let body = '';
        req.on('data', d => body += d);
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            fs.writeFileSync(HITBOX_FILE, JSON.stringify(data, null, 2));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });
    }
  };
}


export default defineConfig({
  plugins: [mapEditorApiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    cors: true,
    proxy: {
      '/colyseus': {
        target: 'http://localhost:2567',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/colyseus/, ''),
      }
    }
  }
});

