import Phaser from 'phaser';
import { CHARACTER_CONFIG } from '../config/characters.js';

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    // We will start actual loading inside create() or via a custom method
    // to have more control over dynamic queues and the HTML UI.
  }

  create() {
    // Wait for the trigger from HTML button
    window.addEventListener('start-global-load', () => {
      this.startGlobalLoad();
    });
  }

  async startGlobalLoad() {
    const overlay = document.getElementById('global-loading-overlay');
    const bar = document.getElementById('global-loading-bar');
    const text = document.getElementById('global-loading-text');
    const detail = document.getElementById('global-loading-detail');
    
    if (overlay) overlay.style.display = 'flex';
    
    // We will fetch levels.json and hitboxes.json via fetch API 
    // to know exactly what to queue in Phaser's Loader.
    try {
      detail.innerText = "Fetching configuration...";
      const [levelsRes, hitboxesRes] = await Promise.all([
        fetch('/levels.json?t=' + Date.now()),
        fetch('/characters/hitboxes.json?t=' + Date.now())
      ]);
      
      const levelsRaw = await levelsRes.json();
      const hitboxesRaw = await hitboxesRes.json();

      detail.innerText = "Queueing assets...";
      
      // Cache the configurations manually since we fetched them via browser fetch
      this.cache.json.add('levels_config', levelsRaw);
      this.cache.json.add('hitbox_config', hitboxesRaw);

      // 1. Queue Maps & Collisions
      const availableMaps = ['default', 'Castle', 'Dust'];
      availableMaps.forEach(mapName => {
        if (!this.textures.exists(`map_${mapName}`)) {
          this.load.image(`map_${mapName}`, `/maps/${mapName}.png`);
        }
        if (!this.cache.json.exists(`collisions_${mapName}`)) {
          this.load.json(`collisions_${mapName}`, `/maps/${mapName}_collisions.json`);
        }
      });

      // 2. Queue Projectiles from Hitboxes
      let queuedProjectiles = 0;
      for (const charKey in hitboxesRaw) {
        for (const animKey in hitboxesRaw[charKey]) {
          const proj = hitboxesRaw[charKey][animKey].proj;
          if (proj && proj.enabled) {
            const getPath = (p) => p.startsWith('/public') ? p.replace('/public', '') : p;
            if (proj.animated && proj.path && !this.textures.exists(proj.texture + '_moving')) {
              this.load.spritesheet(proj.texture + '_moving', getPath(proj.path), { frameWidth: proj.fw, frameHeight: proj.fh });
              queuedProjectiles++;
            } else if (proj.path && !this.textures.exists(proj.texture)) {
              this.load.image(proj.texture, getPath(proj.path));
              queuedProjectiles++;
            }
            if (proj.explodePath && !this.textures.exists(proj.texture + '_explode')) {
              this.load.spritesheet(proj.texture + '_explode', getPath(proj.explodePath), { frameWidth: proj.efw, frameHeight: proj.efh });
            }
          }
        }
      }

      // Load arrow for ranged attacks (fallback)
      this.load.image('arrow', '/characters/lyra/arrow.png');

      // 3. Queue Characters
      Object.keys(CHARACTER_CONFIG).forEach(key => {
        const config = CHARACTER_CONFIG[key];
        if (config.singleSpritesheet) {
          if (!this.textures.exists(`${key}_all`)) {
            this.load.spritesheet(
              `${key}_all`, 
              `/characters/${config.folder}/${config.singleSpritesheet}`, 
              { frameWidth: config.frameWidth, frameHeight: config.frameHeight }
            );
          }
        } else {
          Object.keys(config.animations).forEach(anim => {
            if (!this.textures.exists(`${key}_${anim}`)) {
              this.load.spritesheet(
                `${key}_${anim}`, 
                `/characters/${config.folder}/${anim}.png`, 
                { frameWidth: config.frameWidth, frameHeight: config.frameHeight }
              );
            }
          });
        }
      });

      // Hook up progress
      this.load.on('progress', (value) => {
        const percent = Math.floor(value * 100);
        if (bar) bar.style.width = `${percent}%`;
        if (text) text.innerText = `${percent}%`;
        if (detail) detail.innerText = `Downloading assets...`;
      });

      this.load.on('filecomplete', (key) => {
        if (detail) detail.innerText = `Loaded: ${key}`;
      });

      this.load.once('complete', () => {
        if (bar) bar.style.width = `100%`;
        if (text) text.innerText = `100%`;
        if (detail) detail.innerText = `Initialization Complete!`;
        
        setTimeout(() => {
          if (overlay) overlay.style.display = 'none';
          
          // Show the lobby
          const startScreen = document.getElementById('start-screen');
          if (startScreen) startScreen.style.display = 'flex';
          
          // Move to SelectionScene in the background
          this.scene.start('SelectionScene');
        }, 500); // short delay for visual completion
      });

      // Start the loading!
      this.load.start();

      // If nothing was queued (e.g. everything cached), complete won't fire automatically if start() has nothing to do.
      if (this.load.totalToLoad === 0) {
        this.load.emit('complete');
      }

    } catch (e) {
      console.error("Failed to fetch pre-requisite configs:", e);
      if (detail) detail.innerText = "Error loading configs!";
    }
  }
}
