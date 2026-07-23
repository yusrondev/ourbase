import Phaser from 'phaser';
import { CHARACTER_CONFIG } from '../config/characters.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data) {
    this.characterKey = data.character || 'human'; // 'human' or 'soldier2'
  }

  preload() {
    // Assets are already preloaded globally by SelectionScene!
  }

  create() {
    // 1. Define Fixed World Size (e.g., 2000x2000 pixels)
    this.WORLD_WIDTH = 2000;
    this.WORLD_HEIGHT = 2000;

    // Apply limits to the physics engine and the camera
    this.physics.world.setBounds(0, 0, this.WORLD_WIDTH, this.WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, this.WORLD_WIDTH, this.WORLD_HEIGHT);

    this.enemies = []; // Central array for enemies
    this.enemyGroup = this.physics.add.group(); // Physics group for collisions
    
    // Create Player based on selection (Spawn in the middle of the world)
    const playerConfig = CHARACTER_CONFIG[this.characterKey];
    this.player = this.physics.add.sprite(this.WORLD_WIDTH / 2, this.WORLD_HEIGHT / 2, `${this.characterKey}_idle`);
    const playerScale = playerConfig.scale || 1;
    this.player.setScale(playerScale);
    const pBodyWidth = 30 / playerScale;
    const pBodyHeight = 40 / playerScale;
    this.player.setSize(pBodyWidth, pBodyHeight);
    this.player.setOffset(
      (playerConfig.frameWidth - pBodyWidth) / 2, 
      (playerConfig.frameHeight / 2) - (20 / playerScale)
    );
    this.player.play(`${this.characterKey}_idle`);
    this.player.setCollideWorldBounds(true);
    this.player.hp = playerConfig.hp;
    this.playerMaxHp = playerConfig.hp;
    this.playerHpBar = this.add.graphics();
    
    // 2. Camera Follows Player
    this.cameras.main.startFollow(this.player, true, 0.05, 0.05);

    // Create Enemies helper
    this.spawnEnemy = (x, y, type, hpOverride, scale = 1) => {
      const enemyConfig = CHARACTER_CONFIG[type];
      const hp = hpOverride || enemyConfig.hp;
      const enemy = this.physics.add.sprite(x, y, `${type}_idle`);
      
      const eScale = (enemyConfig.scale || 1) * scale;
      enemy.setScale(eScale);
      const eBodyW = 30 / eScale;
      const eBodyH = 40 / eScale;
      enemy.setSize(eBodyW, eBodyH);
      enemy.setOffset(
        (enemyConfig.frameWidth - eBodyW) / 2, 
        (enemyConfig.frameHeight / 2) - (20 / eScale)
      );
      enemy.play(`${type}_idle`);
      enemy.setCollideWorldBounds(true);
      enemy.hp = hp;
      enemy.maxHp = hp;
      enemy.type = type;
      enemy.hpBar = this.add.graphics();
      enemy.isAttacking = false;
      enemy.isHurt = false;
      
      this.enemyGroup.add(enemy);
      
      enemy.on(`animationcomplete-${type}_attack`, () => {
        enemy.isAttacking = false;
      });
      
      enemy.on(`animationcomplete-${type}_hurt`, () => {
        enemy.isHurt = false;
      });
      
      this.enemies.push(enemy);
      return enemy;
    };

    // --- Wave System Configuration ---
    // Note: We've simplified the wave config by removing hardcoded bounding boxes (ox, oy, w, h)
    // because those are now dynamically handled in spawnEnemy via the character configuration!
    this.waves = [
      // Wave 1
      [{ type: 'slime', x: 800, y: 1000 }],
      // Wave 2
      [{ type: 'blood', x: 1200, y: 1000 }],
      // Wave 3
      [
        { type: 'demon', x: 1000, y: 800 },
        { type: 'slime', x: 800, y: 1200 }
      ],
      // Wave 4: Orc
      [{ type: 'orc', x: 1000, y: 1200 }]
    ];
    this.currentWaveIndex = 0;
    
    this.startWave = (index) => {
      const wave = this.waves[index];
      if (!wave) return;
      wave.forEach(enemyConfig => {
        this.spawnEnemy(
          enemyConfig.x, enemyConfig.y, enemyConfig.type, enemyConfig.hp
        );
      });
    };

    // State Flags
    this.isAttacking = false;
    this.isHurt = false;
    this.isGameOver = false;

    // Controls
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });
    this.spaceBar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.isGuarding = false;
    
    this.player.on(`animationcomplete`, (anim) => {
      if (anim.key === `${this.characterKey}_attack` || anim.key === `${this.characterKey}_heal`) {
        this.isAttacking = false;
      }
    });
    
    this.player.on(`animationcomplete-${this.characterKey}_hurt`, () => {
      this.isHurt = false;
    });

    // Add Virtual Controls
    this.createVirtualControls();
  }

  update() {
    if (this.isGameOver) return;

    // Clean up dead enemies from logic array
    this.enemies = this.enemies.filter(enemy => {
      return enemy.hp > 0 || enemy.anims.isPlaying;
    });

    // Count alive enemies for Wave progression
    const aliveEnemies = this.enemies.filter(e => e.hp > 0).length;
    
    if (aliveEnemies === 0 && this.currentWaveIndex < this.waves.length) {
      this.startWave(this.currentWaveIndex);
      this.currentWaveIndex++;
    }

    // Draw Player HP Bar
    if (this.player.hp > 0) {
      this.drawHealthBar(this.playerHpBar, this.player.x - 20, this.player.y - 35, 40, 5, this.player.hp, this.playerMaxHp, 0x4ade80);
    } else {
      this.playerHpBar.clear();
    }

    this.isGuarding = false;

    // Check virtual button state change for 'JustDown' behavior
    const isVirtualActionDown = this.isBtnADown && !this.wasBtnADown;
    this.wasBtnADown = this.isBtnADown;
    const isActionTriggered = Phaser.Input.Keyboard.JustDown(this.spaceBar) || isVirtualActionDown;
    const isGuardTriggered = this.shiftKey.isDown || this.isBtnBDown;

    // Player Attack Logic
    if (this.isHurt) {
      // Don't allow movement or attacking while hurt
    } else if (this.isAttacking) {
      this.player.setVelocity(0);
    } else if (this.characterKey === 'tank' && isGuardTriggered && this.player.hp > 0) {
      this.isGuarding = true;
      this.player.setVelocity(0);
      this.player.play(`${this.characterKey}_guard`, true);
    } else if (isActionTriggered && this.player.hp > 0) {
      this.isAttacking = true;
      const actionName = this.characterKey === 'monk' ? 'heal' : 'attack';
      this.player.play(`${this.characterKey}_${actionName}`, true);
      this.player.setVelocity(0);
      
      // Delay effect execution
      this.time.delayedCall(350, () => {
        if(this.isHurt || this.player.hp <= 0) return; // If got hit before action completes, cancel

        if (this.characterKey === 'monk') {
          // AoE Heal logic (Area of Effect)
          const healRadius = 150; // Jangkauan radius area heal
          const allies = [this.player]; // Disiapkan untuk multiplayer di masa depan
          
          allies.forEach(ally => {
            if (ally.hp <= 0) return;
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, ally.x, ally.y);
            
            if (dist <= healRadius) {
              const healAmt = CHARACTER_CONFIG.monk.attack;
              ally.hp += healAmt;
              const maxHp = ally === this.player ? this.playerMaxHp : ally.maxHp;
              if (ally.hp > maxHp) ally.hp = maxHp;
              
              this.showFloatingText(ally.x, ally.y - 40, `+${healAmt}`, '#4ade80');

              // Play heal_effect sprite overlay for each healed ally
              const healEffect = this.add.sprite(ally.x, ally.y, 'monk_heal_effect');
              healEffect.setDepth(ally.depth + 1); // Layer 2 (above character)
              healEffect.play('monk_heal_effect');
              healEffect.on('animationcomplete', () => {
                healEffect.destroy();
              });
            }
          });
        } else {
          // Standard Attack logic
          this.enemies.forEach(enemy => {
            if (enemy.hp <= 0) return;
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
            if (dist < 45) {
              const dmg = CHARACTER_CONFIG[this.characterKey].attack;
              enemy.hp -= dmg;
              this.showFloatingText(enemy.x, enemy.y - 40, `-${dmg}`, '#ffffff');
              
              if (enemy.hp <= 0) {
                enemy.hpBar.clear();
                enemy.setVelocity(0);
                enemy.body.enable = false;
                if (this.anims.exists(`${enemy.type}_death`)) {
                  enemy.play(`${enemy.type}_death`);
                }
              } else {
                enemy.isHurt = true;
                if (this.anims.exists(`${enemy.type}_hurt`)) {
                  enemy.play(`${enemy.type}_hurt`, true);
                }
                enemy.isAttacking = false; // Cancel attack if hit

                const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
                enemy.setVelocity(Math.cos(angle) * 150, Math.sin(angle) * 150);
                setTimeout(() => { if (enemy && enemy.hp > 0) enemy.setVelocity(0); }, 150);
              }
            }
          });
        }
      });
    } else if (this.player.hp > 0) {
      // Player Movement
      let velocityX = 0;
      let velocityY = 0;
      const speed = CHARACTER_CONFIG[this.characterKey].speed;

      // Virtual Joystick Logic
      if (this.joyStick && this.joyStick.force > 0) {
        velocityX = Math.cos(this.joyStick.rotation) * speed;
        velocityY = Math.sin(this.joyStick.rotation) * speed;
        this.player.flipX = velocityX < 0;
      } else {
        // Keyboard Logic Fallback
        if (this.cursors.left.isDown || this.wasd.left.isDown) {
          velocityX = -speed;
          this.player.flipX = true;
        } else if (this.cursors.right.isDown || this.wasd.right.isDown) {
          velocityX = speed;
          this.player.flipX = false;
        }

        if (this.cursors.up.isDown || this.wasd.up.isDown) {
          velocityY = -speed;
        } else if (this.cursors.down.isDown || this.wasd.down.isDown) {
          velocityY = speed;
        }

        // Normalize keyboard velocity
        if (velocityX !== 0 && velocityY !== 0) {
          velocityX *= 0.7071;
          velocityY *= 0.7071;
        }
      }

      this.player.setVelocity(velocityX, velocityY);

      if (velocityX !== 0 || velocityY !== 0) {
        this.player.play(`${this.characterKey}_walk`, true);
      } else {
        this.player.play(`${this.characterKey}_idle`, true);
      }
    }

    // Update Enemies
    this.enemies.forEach(enemy => {
      if (enemy.hp <= 0) return;

      // Draw HP Bar
      this.drawHealthBar(enemy.hpBar, enemy.x - 15, enemy.y - 25, 30, 4, enemy.hp, enemy.maxHp, 0xf87171);

      if (this.player.hp <= 0) {
        enemy.setVelocity(0);
        if (!enemy.isHurt) enemy.play(`${enemy.type}_idle`, true);
        return;
      }

      if (enemy.isHurt) {
        // Just being pushed back or stunned, don't move or attack
        return;
      }

      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      const attackRange = (enemy.type === 'demon' || enemy.type === 'orc') ? 40 : 35;

      if (enemy.isAttacking) {
        enemy.setVelocity(0, 0);
      } else if (dist < attackRange) {
        // Enemy attacks
        enemy.isAttacking = true;
        enemy.setVelocity(0, 0);
        enemy.play(`${enemy.type}_attack`, true);
        enemy.flipX = (enemy.x > this.player.x);
        
        // Delay attack hit
        this.time.delayedCall(300, () => {
          if (this.player.hp > 0 && enemy.hp > 0 && !enemy.isHurt) {
            const currentDist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
            if (currentDist < attackRange + 15) {
              if (this.isGuarding) {
                // Ignore damage, repel enemy
                const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
                enemy.setVelocity(Math.cos(angle) * 150, Math.sin(angle) * 150);
                setTimeout(() => { if (enemy && enemy.hp > 0) enemy.setVelocity(0); }, 150);
              } else {
                const dmg = CHARACTER_CONFIG[enemy.type].attack;
                this.player.hp -= dmg;
                this.showFloatingText(this.player.x, this.player.y - 40, `-${dmg}`, '#ff5555');
                
                if (this.player.hp <= 0) {
                  this.playerHpBar.clear();
                  this.player.setVelocity(0);
                  if (this.anims.exists(`${this.characterKey}_death`)) {
                    this.player.play(`${this.characterKey}_death`);
                  }
                  this.isGameOver = true;
                } else {
                  this.isHurt = true;
                  if (this.anims.exists(`${this.characterKey}_hurt`)) {
                    this.player.play(`${this.characterKey}_hurt`, true);
                  } else {
                    // Fallback for characters without hurt animation (like monk/tank)
                    this.time.delayedCall(200, () => { this.isHurt = false; });
                  }
                  this.isAttacking = false; // Cancel attack if hit

                  // Optional knockback for player
                  const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
                  this.player.setVelocity(Math.cos(angle) * 80, Math.sin(angle) * 80);
                  setTimeout(() => { if (this.player && this.player.hp > 0 && !this.isGameOver) this.player.setVelocity(0); }, 150);
                }
              }
            }
          }
        });
      } else if (dist < 350) {
        // Follow player
        this.physics.moveToObject(enemy, this.player, CHARACTER_CONFIG[enemy.type].speed);
        enemy.play(`${enemy.type}_walk`, true);
        enemy.flipX = (enemy.body.velocity.x < 0);
      } else {
        // Idle
        enemy.setVelocity(0, 0);
        enemy.play(`${enemy.type}_idle`, true);
      }
    });

    // --- Update Minimap ---
    if (this.minimapGraphics) {
      this.minimapGraphics.clear();
      
      const mapX = 20;
      const mapY = 20;
      const mapW = 150;
      const mapH = 150;
      const scaleX = mapW / this.WORLD_WIDTH;
      const scaleY = mapH / this.WORLD_HEIGHT;

      // Draw minimap background
      this.minimapGraphics.fillStyle(0x000000, 0.4);
      this.minimapGraphics.fillRect(mapX, mapY, mapW, mapH);
      this.minimapGraphics.lineStyle(2, 0xffffff, 0.3);
      this.minimapGraphics.strokeRect(mapX, mapY, mapW, mapH);

      // Draw enemies
      this.minimapGraphics.fillStyle(0xff5555, 1);
      this.enemies.forEach(e => {
        if (e.hp > 0) {
          this.minimapGraphics.fillCircle(mapX + e.x * scaleX, mapY + e.y * scaleY, 2);
        }
      });

      // Draw player
      this.minimapGraphics.fillStyle(0x4ade80, 1);
      this.minimapGraphics.fillCircle(mapX + this.player.x * scaleX, mapY + this.player.y * scaleY, 3);
    }
  }

  showFloatingText(x, y, message, color) {
    const text = this.add.text(x, y, message, {
      fontSize: '28px',
      fill: color,
      fontFamily: 'Outfit, sans-serif',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(300);

    // Floating animation (flies up and fades out)
    this.tweens.add({
      targets: text,
      y: y - 60,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => text.destroy()
    });
  }

  drawHealthBar(graphics, x, y, width, height, hp, maxHp, color) {
    graphics.clear();
    // background
    graphics.fillStyle(0x000000, 0.8);
    graphics.fillRect(x, y, width, height);
    // health
    graphics.fillStyle(color, 1);
    const hpWidth = Math.max(0, (hp / maxHp) * width);
    graphics.fillRect(x, y, hpWidth, height);
    // border
    graphics.lineStyle(1, 0x000000, 1);
    graphics.strokeRect(x, y, width, height);
  }

  createVirtualControls() {
    const { width, height } = this.scale;

    this.joyStick = this.plugins.get('rexVirtualJoystick').add(this, {
      x: 120,
      y: height - 120,
      radius: 60,
      base: this.add.circle(0, 0, 70).setStrokeStyle(4, 0xffffff, 0.5).setFillStyle(0x000000, 0.2),
      thumb: this.add.circle(0, 0, 35).setStrokeStyle(3, 0xffffff, 0.8).setFillStyle(0xffffff, 0.4),
      forceMin: 16
    });

    // Fix joystick position to camera (UI overlay)
    this.joyStick.base.setScrollFactor(0).setDepth(100);
    this.joyStick.thumb.setScrollFactor(0).setDepth(100);

    // Action A Button (Attack/Heal)
    this.btnA = this.add.circle(width - 120, height - 100, 45).setStrokeStyle(4, 0xffffff, 0.5).setFillStyle(0x000000, 0.2)
      .setInteractive()
      .setScrollFactor(0)
      .setDepth(100);
    
    this.txtA = this.add.text(width - 120, height - 100, 'A', { fontSize: '36px', fill: '#fff', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101);

    this.btnA.on('pointerdown', () => { 
      this.isBtnADown = true; 
      this.btnA.setFillStyle(0xffffff, 0.4);
    });
    this.btnA.on('pointerup', () => { 
      this.isBtnADown = false; 
      this.btnA.setFillStyle(0x000000, 0.2);
    });
    this.btnA.on('pointerout', () => { 
      this.isBtnADown = false; 
      this.btnA.setFillStyle(0x000000, 0.2);
    });

    // Action B Button (Guard) - only shown for tank
    this.btnB = this.add.circle(width - 220, height - 60, 35).setStrokeStyle(4, 0xffffff, 0.5).setFillStyle(0x000000, 0.2)
      .setInteractive()
      .setScrollFactor(0)
      .setDepth(100);

    this.txtB = this.add.text(width - 220, height - 60, 'B', { fontSize: '28px', fill: '#fff', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101);

    this.btnB.on('pointerdown', () => { 
      this.isBtnBDown = true; 
      this.btnB.setFillStyle(0xffffff, 0.4);
    });
    this.btnB.on('pointerup', () => { 
      this.isBtnBDown = false; 
      this.btnB.setFillStyle(0x000000, 0.2);
    });
    this.btnB.on('pointerout', () => { 
      this.isBtnBDown = false; 
      this.btnB.setFillStyle(0x000000, 0.2);
    });

    if (this.characterKey !== 'tank') {
      this.btnB.setVisible(false);
      this.txtB.setVisible(false);
    }

    // Minimap Graphics
    this.minimapGraphics = this.add.graphics();
    this.minimapGraphics.setScrollFactor(0);
    this.minimapGraphics.setDepth(99);

    // Handle Resize
    this.scale.on('resize', this.resizeControls, this);
    
    // Force initial sizing calculations
    this.resizeControls(this.scale);
  }

  resizeControls(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;

    this.joyStick.x = 120;
    this.joyStick.y = height - 120;

    this.btnA.setPosition(width - 120, height - 100);
    this.txtA.setPosition(width - 120, height - 100);
    
    this.btnB.setPosition(width - 220, height - 60);
    this.txtB.setPosition(width - 220, height - 60);
  }
}
