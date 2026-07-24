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
let mySelectedCharKey = 'lucien'; // Local override for instant avatar update
const selectableHeroKeys = Object.keys(CHARACTER_CONFIG).filter(key => CHARACTER_CONFIG[key].role);

function updateHeroDetails(key) {
  const config = CHARACTER_CONFIG[key];
  if (!config) return;

  const detailName = document.getElementById('detail-name');
  const detailRole = document.getElementById('detail-role');
  const detailDesc = document.getElementById('detail-desc');
  if (detailName) detailName.innerText = config.name;
  if (detailRole) detailRole.innerText = config.role || '';
  if (detailDesc) detailDesc.innerText = config.description || 'Tidak ada deskripsi.';

  // Max bounds for calculating progress bar percentages
  const maxHP = 300;
  const maxATK = 50;
  const maxSPD = 250;

  const hpPct = Math.min(100, (config.hp / maxHP) * 100);
  const atkPct = Math.min(100, (config.attack / maxATK) * 100);
  const spdPct = Math.min(100, (config.speed / maxSPD) * 100);

  const barHp = document.getElementById('bar-hp');
  const barAtk = document.getElementById('bar-atk');
  const barSpd = document.getElementById('bar-spd');
  if (barHp) barHp.style.width = `${hpPct}%`;
  if (barAtk) barAtk.style.width = `${atkPct}%`;
  if (barSpd) barSpd.style.width = `${spdPct}%`;

  const txtHp = document.getElementById('txt-hp');
  const txtAtk = document.getElementById('txt-atk');
  const txtSpd = document.getElementById('txt-spd');
  if (txtHp) txtHp.innerText = config.hp;
  if (txtAtk) txtAtk.innerText = config.attack;
  if (txtSpd) txtSpd.innerText = config.speed;

  // Hide ATK row for Monk since they are a support/healer class
  const rowAtk = document.getElementById('row-atk');
  if (rowAtk) rowAtk.style.display = key === 'monk' ? 'none' : 'flex';
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

    const avatar = document.createElement('div');
    avatar.className = 'hero-avatar';
    avatar.style.backgroundImage = `url('/characters/${config.folder}/face.png')`;

    const nameLabel = document.createElement('div');
    nameLabel.className = 'hero-name-label';
    nameLabel.innerText = config.name;

    card.appendChild(avatar);
    card.appendChild(nameLabel);

    card.addEventListener('click', () => {
      document.querySelectorAll('.hero-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      activeHeroKey = key;
      mySelectedCharKey = key; // Update local tracking immediately
      updateHeroDetails(key);
      if (typeof window.selectCharacter === 'function') {
        window.selectCharacter(key);
      }
      // Re-render player list so avatar updates instantly
      renderPlayerList();
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
    // Use local tracking for own character (instant update), server state for others
    const charKey = isMe ? mySelectedCharKey : (p.character || null);
    const charConfig = charKey ? CHARACTER_CONFIG[charKey] : null;
    
    const item = document.createElement('div');
    item.className = `dp-player-item${isMe ? ' is-me' : ''}`;
    
    // Avatar (character face or placeholder)
    const avatarEl = document.createElement('div');
    avatarEl.className = 'dp-player-avatar';
    if (charConfig) {
      avatarEl.style.backgroundImage = `url('/characters/${charConfig.folder}/face.png')`;
    } else {
      avatarEl.textContent = '?';
    }
    
    // Name + char name grouped in info div
    const infoEl = document.createElement('div');
    infoEl.className = 'dp-player-info';

    const nameEl = document.createElement('div');
    nameEl.className = 'dp-player-name';
    nameEl.textContent = pName;
    
    const charNameEl = document.createElement('div');
    charNameEl.className = 'dp-player-char-name';
    charNameEl.textContent = charConfig ? charConfig.name : 'Picking...';

    infoEl.appendChild(nameEl);
    infoEl.appendChild(charNameEl);
    
    if (isHost) {
      const crownEl = document.createElement('span');
      crownEl.className = 'dp-host-crown';
      crownEl.textContent = '👑';
      item.appendChild(crownEl);
    }
    
    item.appendChild(avatarEl);
    item.appendChild(infoEl);
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