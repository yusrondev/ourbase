import Phaser from 'phaser';
import SelectionScene from './scenes/SelectionScene.js';
import GameScene from './scenes/GameScene.js';
import VirtualJoystickPlugin from 'phaser3-rex-plugins/plugins/virtualjoystick-plugin.js';

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

  // Force Phaser to recalculate layout after rotation delay
  setTimeout(() => { game.scale.refresh(); }, 200);
  setTimeout(() => { game.scale.refresh(); }, 500);
});
