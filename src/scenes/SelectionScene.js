import Phaser from 'phaser';
import { CHARACTER_CONFIG } from '../config/characters.js';

export default class SelectionScene extends Phaser.Scene {
  constructor() {
    super('SelectionScene');
    this.characters = Object.keys(CHARACTER_CONFIG).filter(key => CHARACTER_CONFIG[key].name);
    this.currentIndex = 0;
  }

  preload() {
    // Load all character spritesheets here so they are ready globally
    Object.keys(CHARACTER_CONFIG).forEach(key => {
      const config = CHARACTER_CONFIG[key];
      Object.keys(config.animations).forEach(anim => {
        this.load.spritesheet(
          `${key}_${anim}`, 
          `/characters/${config.folder}/${anim}.png`, 
          { frameWidth: config.frameWidth, frameHeight: config.frameHeight }
        );
      });
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
          this.anims.create({
            key: `${key}_${anim}`,
            frames: this.anims.generateFrameNumbers(`${key}_${anim}`, { start: 0, end: animConfig.frames - 1 }),
            frameRate: animConfig.rate,
            repeat: animConfig.repeat
          });
        }
      });
    });

    // Preview Sprite centered in the transparent left 35% of the screen
    // 35% of width is the preview zone, so middle is width * 0.175
    this.previewSprite = this.add.sprite(width * 0.175, height * 0.38, `${this.characters[this.currentIndex]}_idle`);
    const initialConfig = CHARACTER_CONFIG[this.characters[this.currentIndex]];
    this.previewSprite.setScale(3.5 * (initialConfig.scale || 1));
    this.previewSprite.play(`${this.characters[this.currentIndex]}_idle`);

    // Handle Resize
    this.scale.on('resize', this.resizeUI, this);
    this.resizeUI(this.scale);

    // Expose select callback to HTML overlay
    window.selectCharacter = (key) => {
      const index = this.characters.indexOf(key);
      if (index !== -1) {
        this.currentIndex = index;
        const config = CHARACTER_CONFIG[key];
        
        this.previewSprite.setTexture(`${key}_idle`);
        this.previewSprite.play(`${key}_idle`);
        
        // Re-scale on change
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const baseScale = (config.scale || 1);
        const responsiveScale = (height / 720) * 4.5;
        this.previewSprite.setScale(baseScale * Math.max(1.8, responsiveScale));
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
      this.bg.setDisplaySize(width, height);
      
      // Update preview sprite position based on layout
      this.previewSprite.setPosition(width * 0.175, height * 0.38);
      
      const config = CHARACTER_CONFIG[this.characters[this.currentIndex]];
      const baseScale = (config.scale || 1);
      const responsiveScale = (height / 720) * 4.5;
      this.previewSprite.setScale(baseScale * Math.max(1.8, responsiveScale));
    }
  }
}
