import Phaser from 'phaser';
import { CHARACTER_CONFIG } from '../config/characters.js';

export default class SelectionScene extends Phaser.Scene {
  constructor() {
    super('SelectionScene');
    this.characters = Object.keys(CHARACTER_CONFIG);
    this.currentIndex = 0;
  }

  preload() {
    // Load all character spritesheets here so they are ready globally
    this.characters.forEach(key => {
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

    // Background
    this.bg = this.add.rectangle(0, 0, width, height, 0x1f2937).setOrigin(0);

    // Title
    this.titleText = this.add.text(width / 2, 80, 'CHOOSE YOUR HERO', {
      fontSize: '36px',
      fill: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Character Previews - dynamically create animations first
    this.characters.forEach(key => {
      const config = CHARACTER_CONFIG[key];
      Object.keys(config.animations).forEach(anim => {
        const animConfig = config.animations[anim];
        
        // Prevent duplicate animation creation errors if the scene is restarted
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

    // TitleScene already handled Fullscreen/Landscape, so we just add a resize listener
    this.scale.on('resize', this.resizeUI, this);

    // Preview Sprite Container
    this.previewSprite = this.add.sprite(width / 2, 350, `${this.characters[this.currentIndex]}_idle`);
    const initialConfig = CHARACTER_CONFIG[this.characters[this.currentIndex]];
    this.previewSprite.setScale(3.5 * (initialConfig.scale || 1)); // Made bigger for 720p
    this.previewSprite.play(`${this.characters[this.currentIndex]}_idle`);

    // Character Name Label
    this.nameText = this.add.text(width / 2, 520, this.getFormattedName(this.characters[this.currentIndex]), {
      fontSize: '36px',
      fill: '#4ade80',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Stats Label
    this.statsText = this.add.text(width / 2, 570, `HP: ${initialConfig.hp}  |  ATK: ${initialConfig.attack}  |  SPD: ${initialConfig.speed}`, {
      fontSize: '24px',
      fill: '#d1d5db'
    }).setOrigin(0.5);

    // Prev Button
    this.btnPrev = this.add.text(width / 2 - 250, 350, '< PREV', {
      fontSize: '36px',
      fill: '#9ca3af',
      fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    this.btnPrev.on('pointerover', () => this.btnPrev.setFill('#ffffff'));
    this.btnPrev.on('pointerout', () => this.btnPrev.setFill('#9ca3af'));
    this.btnPrev.on('pointerdown', () => this.changeCharacter(-1));

    // Next Button
    this.btnNext = this.add.text(width / 2 + 250, 350, 'NEXT >', {
      fontSize: '36px',
      fill: '#9ca3af',
      fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    this.btnNext.on('pointerover', () => this.btnNext.setFill('#ffffff'));
    this.btnNext.on('pointerout', () => this.btnNext.setFill('#9ca3af'));
    this.btnNext.on('pointerdown', () => this.changeCharacter(1));

    // Start Button
    this.btnStart = this.add.rectangle(width / 2, 650, 300, 80, 0x4ade80)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.btnStart.setFillStyle(0x22c55e))
      .on('pointerout', () => this.btnStart.setFillStyle(0x4ade80))
      .on('pointerdown', () => {
        this.scene.start('GameScene', { character: this.characters[this.currentIndex] });
      });

    this.btnStartText = this.add.text(width / 2, 650, 'START GAME', {
      fontSize: '28px',
      fill: '#000000',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Force proportional layout calculation on initial creation
    this.resizeUI(this.scale);
  }

  resizeUI(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;

    // Ensure camera is updated
    this.cameras.main.setViewport(0, 0, width, height);

    if (this.bg) {
      this.bg.setDisplaySize(width, height);
      
      // Use percentages of height/width to ensure elements never overlap
      this.titleText.setPosition(width / 2, height * 0.15);
      
      this.previewSprite.setPosition(width / 2, height * 0.45);
      // Adjust sprite scale based on screen height to avoid being too large on small screens
      const initialConfig = CHARACTER_CONFIG[this.characters[this.currentIndex]];
      const baseScale = (initialConfig.scale || 1);
      const responsiveScale = (height / 720) * 3.5; 
      this.previewSprite.setScale(baseScale * Math.max(1.5, responsiveScale));
      
      this.nameText.setPosition(width / 2, height * 0.68);
      this.statsText.setPosition(width / 2, height * 0.78);
      
      this.btnPrev.setPosition(width / 2 - (width * 0.25), height * 0.45);
      this.btnNext.setPosition(width / 2 + (width * 0.25), height * 0.45);
      
      this.btnStart.setPosition(width / 2, height * 0.90);
      this.btnStartText.setPosition(width / 2, height * 0.90);
      this.btnStart.setSize(width * 0.4, height * 0.12);
    }
  }

  changeCharacter(dir) {
    this.currentIndex += dir;
    if (this.currentIndex < 0) this.currentIndex = this.characters.length - 1;
    if (this.currentIndex >= this.characters.length) this.currentIndex = 0;

    const key = this.characters[this.currentIndex];
    const config = CHARACTER_CONFIG[key];
    this.previewSprite.setTexture(`${key}_idle`);
    this.previewSprite.play(`${key}_idle`);
    this.previewSprite.setScale(2.5 * (config.scale || 1));
    this.nameText.setText(this.getFormattedName(key));
    this.statsText.setText(`HP: ${config.hp}  |  ATK: ${config.attack}  |  SPD: ${config.speed}`);
  }

  getFormattedName(key) {
    const map = {
      human: 'Human Soldier',
      soldier2: 'Advanced Soldier',
      slime: 'Slime Monster',
      blood: 'Blood Monster',
      demon: 'Demon Overlord',
      orc: 'Brutal Orc'
    };
    return map[key] || key.toUpperCase();
  }
}
