import Phaser from 'phaser';
import { CHARACTER_CONFIG } from '../config/characters.js';

export default class SelectionScene extends Phaser.Scene {
  constructor() {
    super('SelectionScene');
    this.characters = Object.keys(CHARACTER_CONFIG).filter(key => CHARACTER_CONFIG[key].role);
    this.currentIndex = 0;
  }

  preload() {
    // Load all character spritesheets here so they are ready globally
    Object.keys(CHARACTER_CONFIG).forEach(key => {
      const config = CHARACTER_CONFIG[key];
      if (config.singleSpritesheet) {
        this.load.spritesheet(
          `${key}_all`, 
          `/characters/${config.folder}/${config.singleSpritesheet}`, 
          { frameWidth: config.frameWidth, frameHeight: config.frameHeight }
        );
      } else {
        Object.keys(config.animations).forEach(anim => {
          this.load.spritesheet(
            `${key}_${anim}`, 
            `/characters/${config.folder}/${anim}.png`, 
            { frameWidth: config.frameWidth, frameHeight: config.frameHeight }
          );
        });
      }
    });
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Background (Dark gray/navy gradient to align with HTML sidebar)
    this.bg = this.add.rectangle(0, 0, width, height, 0x0f172a).setOrigin(0);

    // Register animations
    Object.keys(CHARACTER_CONFIG).forEach(key => {
      const config = CHARACTER_CONFIG[key];
      Object.keys(config.animations).forEach(anim => {
        const animConfig = config.animations[anim];
        
        if (!this.anims.exists(`${key}_${anim}`)) {
          if (config.singleSpritesheet) {
            this.anims.create({
              key: `${key}_${anim}`,
              frames: this.anims.generateFrameNumbers(`${key}_all`, { start: animConfig.start, end: animConfig.end }),
              frameRate: animConfig.rate,
              repeat: animConfig.repeat
            });
          } else {
            this.anims.create({
              key: `${key}_${anim}`,
              frames: this.anims.generateFrameNumbers(`${key}_${anim}`, { start: 0, end: animConfig.frames - 1 }),
              frameRate: animConfig.rate,
              repeat: animConfig.repeat
            });
          }
        }
      });
    });

    // Removed Preview Sprite rendering (UI now handles character description)

    // Handle Resize
    this.scale.on('resize', this.resizeUI, this);
    this.resizeUI(this.scale);

    // Expose select callback to HTML overlay
    window.selectCharacter = (key) => {
      const index = this.characters.indexOf(key);
      if (index !== -1) {
        this.currentIndex = index;
      }
    };

    // Expose start game callback to HTML overlay
    window.startGame = () => {
      const selectedHero = this.characters[this.currentIndex];
      // Transition to game scene
      this.scene.start('GameScene', { character: selectedHero });
    };
  }

  resizeUI(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;

    this.cameras.main.setViewport(0, 0, width, height);

    if (this.bg) {
      this.bg.setSize(width, height);
    }
  }
}
