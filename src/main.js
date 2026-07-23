import Phaser from 'phaser';
import SelectionScene from './scenes/SelectionScene.js';
import GameScene from './scenes/GameScene.js';
import VirtualJoystickPlugin from 'phaser3-rex-plugins/plugins/virtualjoystick-plugin.js';
import { CHARACTER_CONFIG } from './config/characters.js';
import { multiplayer } from './MultiplayerManager.js';

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

// Handle Start Game from Selection Screen
document.getElementById('select-hero-btn').addEventListener('click', () => {
  if (multiplayer.isHost) {
    multiplayer.startGame();
  } else {
    document.getElementById('select-hero-btn').innerText = "WAITING FOR HOST...";
  }
});

// Update Player List in Lobby Info Box
function renderPlayerList() {
  if (!multiplayer.room) return;
  const listContainer = document.getElementById('lobby-player-list');
  if (!listContainer) return;
  listContainer.innerHTML = '';
  
  multiplayer.room.state.players.forEach(p => {
    if (!p) return;
    const pName = p.name || 'Player';
    const isMe = p.id === multiplayer.room.sessionId;
    const isHost = p.isHost;
    
    const item = document.createElement('div');
    item.className = 'lobby-player-item';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'lobby-player-name';
    nameSpan.innerText = `👤 ${pName}${isMe ? ' (You)' : ''}`;
    
    item.appendChild(nameSpan);
    
    if (isHost) {
      const hostBadge = document.createElement('span');
      hostBadge.className = 'lobby-host-badge';
      hostBadge.innerText = 'HOST';
      item.appendChild(hostBadge);
    }
    
    listContainer.appendChild(item);
  });
}

function showSelectionScreen() {
  const docElm = document.documentElement;
  if (docElm.requestFullscreen) docElm.requestFullscreen();
  else if (docElm.webkitRequestFullscreen) docElm.webkitRequestFullscreen();
  
  try {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  } catch(e) {}
  
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('selection-screen').style.display = 'flex';
  
  const lobbyRoomId = document.getElementById('lobby-room-id');
  if (lobbyRoomId) {
    lobbyRoomId.innerText = multiplayer.roomId || '----';
  }

  updateHeroDetails(activeHeroKey);
  renderHeroGrid('all');

  setTimeout(() => {
    if (typeof window.selectCharacter === 'function') {
      window.selectCharacter(activeHeroKey);
    }
    multiplayer.setCharacter(activeHeroKey); // Initial sync
  }, 200);

  setTimeout(() => { game.scale.refresh(); }, 200);
  setTimeout(() => { game.scale.refresh(); }, 500);

  // Sync character selection
  const originalSelectCharacter = window.selectCharacter;
  window.selectCharacter = (key) => {
    if (originalSelectCharacter) originalSelectCharacter(key);
    multiplayer.setCharacter(key);
  };
}

// Multiplayer Join/Create Listeners
const btnCreate = document.getElementById('mp-btn-create');
const btnJoin = document.getElementById('mp-btn-join');
const inputName = document.getElementById('mp-name');
const inputRoom = document.getElementById('mp-room-id');
const errorDiv = document.getElementById('mp-error');

function showError(msg) {
  errorDiv.innerText = msg;
  errorDiv.style.display = 'block';
}

function setupRoomListeners() {
  let hasTransitioned = false;
  multiplayer.room.state.players.onAdd(() => renderPlayerList());
  multiplayer.room.state.players.onRemove(() => renderPlayerList());
  multiplayer.room.state.onChange(() => {
    if (hasTransitioned) return;
    renderPlayerList();
    if (multiplayer.room.state.status === 'PLAYING') {
      hasTransitioned = true;
      document.getElementById('selection-screen').style.display = 'none';
      if (typeof window.startGame === 'function') {
        window.startGame();
      }
    }
  });
}

btnCreate.addEventListener('click', async () => {
  const name = inputName.value.trim() || 'Player';
  btnCreate.disabled = true;
  btnCreate.innerText = 'Creating...';
  try {
    await multiplayer.createRoom(name);
    setupRoomListeners();
    showSelectionScreen();
  } catch (err) {
    btnCreate.disabled = false;
    btnCreate.innerText = '🎮 CREATE NEW ROOM';
    showError('Failed to create room: ' + err.message);
  }
});

btnJoin.addEventListener('click', async () => {
  const name = inputName.value.trim() || 'Player';
  const roomId = inputRoom.value.trim();
  if (!roomId) {
    showError('Please enter a Room Code!');
    return;
  }
  btnJoin.disabled = true;
  btnJoin.innerText = 'Joining...';
  try {
    await multiplayer.joinRoom(roomId, name);
    setupRoomListeners();
    showSelectionScreen();
    // Non-host hides start button or shows wait text
    document.getElementById('select-hero-btn').innerText = "WAITING FOR HOST...";
  } catch (err) {
    btnJoin.disabled = false;
    btnJoin.innerText = '🔑 JOIN ROOM';
    showError('Room not found or full!');
  }
});

// Copy Room Code event listener
document.getElementById('btn-copy-code').addEventListener('click', () => {
  if (multiplayer.roomId) {
    navigator.clipboard.writeText(multiplayer.roomId).then(() => {
      const btn = document.getElementById('btn-copy-code');
      btn.innerText = '✅ Copied';
      setTimeout(() => { btn.innerText = '📋 Copy'; }, 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }
});
