import Phaser from 'phaser';
import SelectionScene from './scenes/SelectionScene.js';
import GameScene from './scenes/GameScene.js';
import VirtualJoystickPlugin from 'phaser3-rex-plugins/plugins/virtualjoystick-plugin.js';
import { CHARACTER_CONFIG } from './config/characters.js';

const config = {
  type: Phaser.AUTO,
  scale: {
    mode: Phaser.Scale.RESIZE,
    parent: 'game-container',
    width: '100%',
    height: '100%'
  },
  backgroundColor: '#2d2d2d',
  pixelArt: true,
  input: {
    activePointers: 3
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  plugins: {
    global: [{
      key: 'rexVirtualJoystick',
      plugin: VirtualJoystickPlugin,
      start: true
    }]
  },
  scene: [SelectionScene, GameScene]
};

const game = new Phaser.Game(config);

// --- Hero Selection Logic ---
let activeHeroKey = 'lucien';
const selectableHeroKeys = Object.keys(CHARACTER_CONFIG).filter(key => CHARACTER_CONFIG[key].name);

function updateHeroDetails(key) {
  const config = CHARACTER_CONFIG[key];
  if (!config) return;

  document.getElementById('detail-name').innerText = config.name;
  document.getElementById('detail-role').innerText = config.role;
  document.getElementById('detail-desc').innerText = config.description;

  // Max bounds for calculating progress bar percentages
  const maxHP = 200;
  const maxATK = 35;
  const maxSPD = 200;

  const hpPct = Math.min(100, (config.hp / maxHP) * 100);
  const atkPct = Math.min(100, (config.attack / maxATK) * 100);
  const spdPct = Math.min(100, (config.speed / maxSPD) * 100);

  document.getElementById('bar-hp').style.width = `${hpPct}%`;
  document.getElementById('bar-atk').style.width = `${atkPct}%`;
  document.getElementById('bar-spd').style.width = `${spdPct}%`;

  document.getElementById('txt-hp').innerText = config.hp;
  document.getElementById('txt-atk').innerText = config.attack;
  document.getElementById('txt-spd').innerText = config.speed;

  // Hide ATK row for Monk since they are a support/healer class
  if (key === 'monk') {
    document.getElementById('row-atk').style.display = 'none';
  } else {
    document.getElementById('row-atk').style.display = 'flex';
  }
}

function renderHeroGrid(roleFilter = 'all') {
  const grid = document.getElementById('hero-grid');
  grid.innerHTML = '';

  selectableHeroKeys.forEach(key => {
    const config = CHARACTER_CONFIG[key];
    if (roleFilter !== 'all' && config.role !== roleFilter) return;

    const card = document.createElement('div');
    card.className = `hero-card ${key === activeHeroKey ? 'active' : ''}`;
    card.setAttribute('data-key', key);

    const idleFrames = config.animations.idle.frames;
    
    // Create face icon
    const avatar = document.createElement('div');
    avatar.className = 'hero-avatar';
    avatar.style.width = '48px';
    avatar.style.height = '48px';
    avatar.style.backgroundImage = `url('/characters/${config.folder}/face.png')`;
    avatar.style.backgroundSize = 'cover';
    avatar.style.backgroundPosition = 'center';

    const nameLabel = document.createElement('div');
    nameLabel.className = 'hero-name-label';
    nameLabel.innerText = config.name;

    card.appendChild(avatar);
    card.appendChild(nameLabel);

    card.addEventListener('click', () => {
      // Remove active classes
      document.querySelectorAll('.hero-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      
      activeHeroKey = key;
      updateHeroDetails(key);

      // Trigger Phaser preview change
      if (typeof window.selectCharacter === 'function') {
        window.selectCharacter(key);
      }
    });

    grid.appendChild(card);
  });
}

// Initialize Tabs
document.querySelectorAll('.role-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    const role = tab.getAttribute('data-role');
    renderHeroGrid(role);
  });
});

// Handle Start Game
document.getElementById('select-hero-btn').addEventListener('click', () => {
  document.getElementById('selection-screen').style.display = 'none';
  if (typeof window.startGame === 'function') {
    window.startGame();
  }
});

// Handle Native HTML Start Button
document.getElementById('start-btn').addEventListener('click', () => {
  const docElm = document.documentElement;
  
  // Request Fullscreen
  if (docElm.requestFullscreen) {
    docElm.requestFullscreen();
  } else if (docElm.webkitRequestFullscreen) {
    docElm.webkitRequestFullscreen();
  }
  
  // Lock landscape
  try {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  } catch(e) {}
  
  // Hide Overlay
  document.getElementById('start-screen').style.display = 'none';
  
  // Show Selection HTML Overlay
  document.getElementById('selection-screen').style.display = 'flex';

  // Initialize UI with default character details
  updateHeroDetails(activeHeroKey);
  renderHeroGrid('all');

  // Trigger initial character select in Phaser
  setTimeout(() => {
    if (typeof window.selectCharacter === 'function') {
      window.selectCharacter(activeHeroKey);
    }
  }, 200);

  // Force Phaser to recalculate layout after rotation delay
  setTimeout(() => { game.scale.refresh(); }, 200);
  setTimeout(() => { game.scale.refresh(); }, 500);
});
