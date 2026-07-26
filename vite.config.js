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

      // POST /api/maps/delete — delete a map (PNG + collisions + levels references)
      server.middlewares.use('/api/maps/delete', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        let body = '';
        req.on('data', d => body += d);
        req.on('end', () => {
          try {
            const { mapName } = JSON.parse(body);
            if (!mapName) throw new Error('Missing mapName');
            const safe = path.basename(mapName).replace(/[^a-zA-Z0-9_-]/g, '');
            
            // Delete png and json files
            const pngPath = path.join(MAPS_DIR, `${safe}.png`);
            const jsonPath = path.join(MAPS_DIR, `${safe}_collisions.json`);
            if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);
            if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);

            // Clean up levels.json
            const levelsPath = path.join(__dirname, 'public', 'levels.json');
            if (fs.existsSync(levelsPath)) {
              const levelsData = JSON.parse(fs.readFileSync(levelsPath, 'utf-8') || '[]');
              const filtered = levelsData.filter(lv => lv.map !== safe);
              // Re-index levels sequentially
              const reindexed = filtered.map((lv, idx) => ({
                ...lv,
                level: idx + 1
              }));
              fs.writeFileSync(levelsPath, JSON.stringify(reindexed, null, 2));
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });

      // POST /api/maps/rename — rename a map
      server.middlewares.use('/api/maps/rename', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        let body = '';
        req.on('data', d => body += d);
        req.on('end', () => {
          try {
            const { oldMapName, newMapName } = JSON.parse(body);
            if (!oldMapName || !newMapName) throw new Error('Missing oldMapName or newMapName');
            const safeOld = path.basename(oldMapName).replace(/[^a-zA-Z0-9_-]/g, '');
            const safeNew = path.basename(newMapName).replace(/[^a-zA-Z0-9_-]/g, '');

            const oldPng = path.join(MAPS_DIR, `${safeOld}.png`);
            const newPng = path.join(MAPS_DIR, `${safeNew}.png`);
            const oldJson = path.join(MAPS_DIR, `${safeOld}_collisions.json`);
            const newJson = path.join(MAPS_DIR, `${safeNew}_collisions.json`);

            if (fs.existsSync(oldPng)) fs.renameSync(oldPng, newPng);
            if (fs.existsSync(oldJson)) fs.renameSync(oldJson, newJson);

            // Update levels.json references
            const levelsPath = path.join(__dirname, 'public', 'levels.json');
            if (fs.existsSync(levelsPath)) {
              const levelsData = JSON.parse(fs.readFileSync(levelsPath, 'utf-8') || '[]');
              const updated = levelsData.map(lv => {
                if (lv.map === safeOld) {
                  return { ...lv, map: safeNew };
                }
                return lv;
              });
              fs.writeFileSync(levelsPath, JSON.stringify(updated, null, 2));
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
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
      // GET /api/levels — get all levels configurations
      server.middlewares.use('/api/levels', (req, res, next) => {
        if (req.method !== 'GET') { next(); return; }
        if (req.url !== '/') { next(); return; } // Match exactly /api/levels
        try {
          const filePath = path.join(__dirname, 'public', 'levels.json');
          if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(data);
          } else {
            res.setHeader('Content-Type', 'application/json');
            res.end('[]');
          }
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });

      // POST /api/levels/save — save levels configuration
      server.middlewares.use('/api/levels/save', (req, res, next) => {
        if (req.method !== 'POST') { next(); return; }
        let body = '';
        req.on('data', d => body += d);
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const filePath = path.join(__dirname, 'public', 'levels.json');
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
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

