import Phaser from 'phaser';
import { CHARACTER_CONFIG } from '../config/characters.js';
import { multiplayer } from '../MultiplayerManager.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data) {
    this.characterKey = data.character || 'human'; // 'human' or 'soldier2'
  }

  preload() {
    // Load map background
    this.load.image('map_bg', '/maps/1.png');
    
    // Load collision data for current map
    this.load.json('map_collisions', '/maps/1_collisions.json');
    
    // Load hitbox configs from hitbox editor
    this.load.json('hitbox_config', '/characters/hitboxes.json');
    
    // Load arrow for ranged attacks (now from lyra)
    this.load.image('arrow', '/characters/lyra/arrow.png');
    
    // Load lunaria projectiles
    this.load.spritesheet('lunaria_explode', '/characters/lunaria/projectile/explode.png', { frameWidth: 50, frameHeight: 50 });
    this.load.spritesheet('lunaria_moving', '/characters/lunaria/projectile/moving.png', { frameWidth: 50, frameHeight: 50 });
  }

  create() {
    // 1. Define Fixed World Size (e.g., 800x800 pixels)
    this.WORLD_WIDTH = 800;
    this.WORLD_HEIGHT = 600;

    // Apply limits to the physics engine and the camera
    this.physics.world.setBounds(0, 0, this.WORLD_WIDTH, this.WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, this.WORLD_WIDTH, this.WORLD_HEIGHT);

    // Add map background
    this.add.image(0, 0, 'map_bg').setOrigin(0, 0).setDisplaySize(this.WORLD_WIDTH, this.WORLD_HEIGHT);

    // ── Collision Debug Toggle ──
    this.physics.world.createDebugGraphic();
    this.physics.world.drawDebug = false;
    this.add.text(10, 40, 'Debug Collision: Tekan [O]', { fontSize: '12px', fill: '#0f0' })
      .setScrollFactor(0).setDepth(1000);
    this.input.keyboard.on('keydown-O', () => {
      this.physics.world.drawDebug = !this.physics.world.drawDebug;
      if (!this.physics.world.drawDebug) {
        this.physics.world.debugGraphic.clear();
      }
    });

    // ── Build collision zones from editor data ──
    this.collisionGroup = this.physics.add.staticGroup();
    const collisionData = this.cache.json.get('map_collisions') || [];
    collisionData.forEach(zone => {
      // Only 'red' / 'block' zones are hard collision; skip spawns, portals, etc.
      if (zone.type !== 'red') return;
      // Use zone (invisible area) for reliable static physics body
      const zoneObj = this.add.zone(
        zone.x + zone.width / 2,
        zone.y + zone.height / 2,
        zone.width,
        zone.height
      );
      this.physics.add.existing(zoneObj, true);
      this.collisionGroup.add(zoneObj);
    });

    // ── Build spawn points from editor data ──
    this.playerSpawns = collisionData.filter(z => z.type === 'spawn_player');
    this.enemySpawns = collisionData.filter(z => z.type === 'spawn_enemy');


    this.enemies = []; // Central array for enemies
    this.enemyGroup = this.physics.add.group();
    
    // Projectiles
    this.projectiles = this.physics.add.group();
    this.enemyProjectiles = this.physics.add.group();

    // Handle player projectiles hitting enemies
    this.physics.add.overlap(this.projectiles, this.enemyGroup, (arrow, enemy) => {
      if (enemy.hp <= 0) return;
      
      const dmg = arrow.damage || 10;
      if (multiplayer.room) {
        multiplayer.room.send("damage_enemy", { id: enemy.id, damage: dmg, sourceX: this.player.x, sourceY: this.player.y });
      } else {
        // Single player mode
        this.showFloatingText(enemy.x, enemy.y - 40, `-${dmg}`, '#ffffff');
        this.damageEnemyLocal(enemy, dmg, this.player.x, this.player.y);
      }
      
      arrow.destroy();
    });

    // Create lunaria projectile animations
    if (!this.anims.exists('lunaria_explode')) {
      this.anims.create({
        key: 'lunaria_explode',
        frames: this.anims.generateFrameNumbers('lunaria_explode', { start: 0, end: 6 }),
        frameRate: 15,
        repeat: 0
      });
      this.anims.create({
        key: 'lunaria_moving',
        frames: this.anims.generateFrameNumbers('lunaria_moving', { start: 0, end: 3 }),
        frameRate: 12,
        repeat: -1
      });
    } // Group for ranged attacks
    
    // Helper to damage enemies locally (Host or Singleplayer)
    this.damageEnemyLocal = (enemy, dmg, sourceX, sourceY) => {
      enemy.hp -= dmg;
      if (enemy.hp <= 0) {
        enemy.hpBar.clear();
        if (enemy.nameTag) {
          enemy.nameTag.destroy();
          enemy.nameTag = null;
        }
        enemy.setVelocity(0);
        enemy.body.enable = false;
        if (this.anims.exists(`${enemy.type}_death`)) {
          enemy.play(`${enemy.type}_death`);
        }
        
        // Fade out after 1 detik
        this.time.delayedCall(1000, () => {
          if (enemy && enemy.scene) {
            this.tweens.add({
              targets: enemy,
              alpha: 0,
              duration: 1000,
              onComplete: () => {
                if (enemy) enemy.destroy();
              }
            });
          }
        });
      } else {
        enemy.isHurt = true;
        if (this.anims.exists(`${enemy.type}_hurt`)) {
          enemy.play(`${enemy.type}_hurt`, true);
        }
        enemy.isAttacking = false; // Cancel attack if hit

        const angle = Phaser.Math.Angle.Between(sourceX, sourceY, enemy.x, enemy.y);
        enemy.setVelocity(Math.cos(angle) * 150, Math.sin(angle) * 150);
        setTimeout(() => { if (enemy && enemy.hp > 0) enemy.setVelocity(0); }, 150);
      }
    };

    // Handle enemy projectiles hitting player
    this.physics.add.overlap(this.enemyProjectiles, this.player, (player, projectile) => {
      if (this.isDead || player.hp <= 0) return;
      
      let dmg = projectile.damage;
      if (this.isGuarding) {
        dmg = Math.max(1, Math.floor(dmg * 0.3));
      }
      
      if (multiplayer.room) {
        if (multiplayer.isHost) {
          multiplayer.room.send("damage_player", { targetId: multiplayer.room.sessionId, damage: dmg, sourceX: projectile.x, sourceY: projectile.y });
        }
      } else {
        // Single player mode
        if (this.isGuarding) {
          player.hp -= dmg;
          this.showFloatingText(player.x, player.y - 40, `Blocked`, '#aaaaaa');
        } else {
          player.hp -= dmg;
          this.showFloatingText(player.x, player.y - 40, `-${dmg}`, '#ff0000');
          if (player.hp > 0) {
            player.isHurt = true;
            player.play(`${this.characterKey}_hurt`, true);
            player.setVelocity(0, 0);
            player.on('animationcomplete', () => { player.isHurt = false; });
          }
        }
        this.checkPlayerDeath();
      }
      
      const explode = this.add.sprite(projectile.x, projectile.y, 'lunaria_explode');
      explode.play('lunaria_explode');
      explode.on('animationcomplete', () => explode.destroy());
      projectile.destroy();
    });
    
    // Create Player based on selection (Spawn at designated spawn point if any)
    const playerConfig = CHARACTER_CONFIG[this.characterKey];
    const initialTexture = playerConfig.singleSpritesheet ? `${this.characterKey}_all` : `${this.characterKey}_idle`;
    
    let spawnX = this.WORLD_WIDTH / 2;
    let spawnY = this.WORLD_HEIGHT / 2;
    if (this.playerSpawns.length > 0) {
      const spawn = Phaser.Math.RND.pick(this.playerSpawns);
      spawnX = spawn.x + spawn.width / 2;
      spawnY = spawn.y + spawn.height / 2;
    }
    
    this.player = this.physics.add.sprite(spawnX, spawnY, initialTexture);
    const playerScale = playerConfig.scale || 1;
    this.player.setScale(playerScale);

    // Apply default/idle hitbox initially
    this.updateHitboxForAnim(this.player, this.characterKey, 'idle');
    
    // Listen for animation changes to update hitbox dynamically
    this.player.on('animationstart', (anim) => {
      // Phaser animations are typically named 'characterKey_animKey'
      const parts = anim.key.split('_');
      if (parts.length >= 2) {
        const animKey = parts.slice(1).join('_');
        this.updateHitboxForAnim(this.player, this.characterKey, animKey);
      }
    });

    this.player.play(`${this.characterKey}_idle`);
    this.player.setCollideWorldBounds(true);
    this.player.hp = playerConfig.hp;
    this.playerMaxHp = playerConfig.hp;

    // ── Collision: player cannot pass through collision zones ──
    this.physics.add.collider(this.player, this.collisionGroup);
    // ── Collision: enemies cannot pass through collision zones ──
    this.physics.add.collider(this.enemyGroup, this.collisionGroup);
    

    // Draw range indicator for ranged characters or Monk
    if (playerConfig.attackType === 'ranged') {
      this.rangeIndicator = this.add.graphics();
      this.rangeRadius = playerConfig.attackRange || 500;
      this.rangeIndicator.lineStyle(2, 0xffffff, 0.3);
      this.rangeIndicator.strokeCircle(0, 0, this.rangeRadius);
    } else if (this.characterKey === 'monk') {
      this.rangeIndicator = this.add.graphics();
      this.rangeRadius = 150; // Area of Effect heal radius
      this.rangeIndicator.lineStyle(2, 0x4ade80, 0.3); // Green circle
      this.rangeIndicator.strokeCircle(0, 0, this.rangeRadius);
    }
    this.playerHpBar = this.add.graphics();
    this.playerHpBar.setDepth(200);
    
    // Handle enemy projectiles hitting player
    this.physics.add.overlap(this.enemyProjectiles, this.player, (player, projectile) => {
      if (this.isDead || player.hp <= 0) return;
      if (this.isGuarding) {
        // Reduced damage if guarding
        player.hp -= Math.max(1, Math.floor(projectile.damage * 0.3));
        this.showFloatingText(player.x, player.y - 40, `Blocked`, '#aaaaaa');
      } else {
        player.hp -= projectile.damage;
        this.showFloatingText(player.x, player.y - 40, `-${projectile.damage}`, '#ff0000');
        
        if (player.hp > 0) {
          player.isHurt = true;
          player.play(`${this.characterKey}_hurt`, true);
          player.setVelocity(0, 0);
          player.on('animationcomplete', () => {
            player.isHurt = false;
          });
        }
      }
      this.checkPlayerDeath();
      
      const explode = this.add.sprite(projectile.x, projectile.y, 'lunaria_explode');
      explode.play('lunaria_explode');
      explode.on('animationcomplete', () => explode.destroy());
      projectile.destroy();
    });
    
    // 2. Camera Follows Player
    this.cameras.main.startFollow(this.player, true, 0.05, 0.05);

    // Create Enemies helper
    let enemyIdCounter = 0;
    this.spawnEnemy = (x, y, type, hpOverride, scale = 1, id = null) => {
      const enemyConfig = CHARACTER_CONFIG[type];
      const hp = hpOverride || enemyConfig.hp;
      const initialEnemyTexture = enemyConfig.singleSpritesheet ? `${type}_all` : `${type}_idle`;
      const enemy = this.physics.add.sprite(x, y, initialEnemyTexture);
      
      const eScale = (enemyConfig.scale || 1) * scale;
      enemy.setScale(eScale);
      
      // Save scale multiplier for dynamic hitbox calculation
      enemy.extraScale = scale;

      // Apply initial hitbox
      this.updateHitboxForAnim(enemy, type, 'idle');

      // Update hitbox on animation change
      enemy.on('animationstart', (anim) => {
        const parts = anim.key.split('_');
        if (parts.length >= 2) {
          const animKey = parts.slice(1).join('_');
          this.updateHitboxForAnim(enemy, type, animKey);
        }
      });

      enemy.play(`${type}_idle`);
      enemy.setCollideWorldBounds(true);
      enemy.hp = hp;
      enemy.maxHp = hp;
      enemy.type = type;
      enemy.id = id || `enemy_${++enemyIdCounter}_${Date.now()}`;
      enemy.hpBar = this.add.graphics();
      enemy.nameTag = this.add.text(0, 0, CHARACTER_CONFIG[type].name, {
        fontSize: '12px',
        fill: '#ffcccc',
        fontFamily: 'Outfit, sans-serif',
        stroke: '#000000',
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(200);
      enemy.isAttacking = false;
      enemy.isHurt = false;
      
      this.enemyGroup.add(enemy);
      
      enemy.on(`animationcomplete-${type}_attack`, () => {
        enemy.isAttacking = false;
      });
      if (this.anims.exists(`${type}_attack2`)) {
        enemy.on(`animationcomplete-${type}_attack2`, () => {
          enemy.isAttacking = false;
        });
      }
      enemy.on('animationstop', (anim) => {
        if (anim && anim.key.includes('attack')) {
          enemy.isAttacking = false;
        }
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
      [{ type: 'slime', x: 300, y: 400 }],
      // Wave 2
      [{ type: 'blood', x: 500, y: 400 }],
      // Wave 3
      [
        { type: 'demon', x: 400, y: 300 },
        { type: 'slime', x: 300, y: 500 }
      ],
      // Wave 4: Orc
      [{ type: 'orc', x: 400, y: 500 }],
      // Wave 5: Kaizer (Boss)
      [{ type: 'kaizer', x: 400, y: 400, hpOverride: 500, scale: 1.5 }],
      // Wave 6: Lunaria (Ranged Boss)
      [{ type: 'lunaria', x: 500, y: 400, scale: 1 }]
    ];
    this.currentWaveIndex = 0;
    
    this.startWave = (index) => {
      const wave = this.waves[index];
      if (!wave) return;
      wave.forEach(enemyConfig => {
        let ex = enemyConfig.x;
        let ey = enemyConfig.y;
        if (this.enemySpawns.length > 0) {
          const spawn = Phaser.Math.RND.pick(this.enemySpawns);
          ex = spawn.x + spawn.width / 2;
          ey = spawn.y + spawn.height / 2;
        }
        this.spawnEnemy(ex, ey, enemyConfig.type, enemyConfig.hp);
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
      if (anim.key === `${this.characterKey}_attack` || anim.key === `${this.characterKey}_attack2` || anim.key === `${this.characterKey}_heal`) {
        this.isAttacking = false;
      }
    });
    
    this.player.on(`animationcomplete-${this.characterKey}_hurt`, () => {
      this.isHurt = false;
    });

    // Add Virtual Controls
    this.createVirtualControls();

    // Setup Multiplayer
    this.remotePlayers = new Map();
    this.isDead = false;

    this.getSafeSpawnPosition = () => {
      // Selalu kembalikan posisi spawn yang ditentukan (tidak random / distance check)
      if (this.playerSpawns.length > 0) {
        const spawn = this.playerSpawns[0]; // Ambil titik spawn pertama
        return { 
          x: spawn.x + spawn.width / 2, 
          y: spawn.y + spawn.height / 2 
        };
      }
      
      // Fallback jika tidak ada spawn point
      return { x: this.WORLD_WIDTH / 2, y: this.WORLD_HEIGHT / 2 };
    };

    this.resuscitatePlayer = () => {
      this.tweens.killTweensOf(this.player); // Stop any active fade-out tweens
      this.player.hp = this.playerMaxHp;
      this.player.alpha = 1;
      this.player.body.enable = true;
      const safePos = this.getSafeSpawnPosition();
      this.player.setPosition(safePos.x, safePos.y);
      this.player.play(`${this.characterKey}_idle`, true); // Force stand up animation!
      
      const overlay = document.getElementById('respawn-overlay');
      if (overlay) {
        overlay.style.display = 'none';
      }
      
      this.isDead = false;
      this.isHurt = false;       // Reset locking state flags!
      this.isAttacking = false;
      this.isGuarding = false;
    };

    this.checkPlayerDeath = () => {
      if (!this.isDead) {
        this.isDead = true;
        this.player.hp = 0;
        this.player.setVelocity(0);
        this.player.body.enable = false;
        
        if (this.anims.exists(`${this.characterKey}_death`)) {
          this.player.play(`${this.characterKey}_death`);
        }

        // Fade out local player sprite
        this.tweens.add({
          targets: this.player,
          alpha: 0,
          duration: 1000
        });

        // Show Respawn Overlay
        const overlay = document.getElementById('respawn-overlay');
        const timerText = document.getElementById('respawn-timer');
        if (overlay && timerText) {
          overlay.style.display = 'flex';
          let cooldown = 5;
          timerText.innerText = cooldown;
          
          const interval = setInterval(() => {
            cooldown--;
            if (timerText) timerText.innerText = cooldown;
            if (cooldown <= 0) {
              clearInterval(interval);
              // Send respawn request to server
              if (multiplayer.room) {
                multiplayer.room.send("respawn_player");
              } else {
                this.resuscitatePlayer();
              }
            }
          }, 1000);
        } else {
          // Fallback if HTML overlay doesn't exist
          this.time.delayedCall(5000, () => {
            if (multiplayer.room) {
              multiplayer.room.send("respawn_player");
            } else {
              this.resuscitatePlayer();
            }
          });
        }
      }
    };

    if (multiplayer.room) {
      // 1. Listen for remote players joining & moving
      multiplayer.room.state.players.onAdd((playerState, sessionId) => {
        if (sessionId !== multiplayer.room.sessionId) {
          const charKey = playerState.character || 'human';
          const pConfig = CHARACTER_CONFIG[charKey];
          const initialTexture = pConfig.singleSpritesheet ? `${charKey}_all` : `${charKey}_idle`;
          
          const rSprite = this.physics.add.sprite(playerState.x || this.WORLD_WIDTH / 2, playerState.y || this.WORLD_HEIGHT / 2, initialTexture);
          const playerScale = pConfig.scale || 1;
          rSprite.setScale(playerScale);
          const pBodyWidth = 30 / playerScale;
          const pBodyHeight = 40 / playerScale;
          rSprite.setSize(pBodyWidth, pBodyHeight);
          rSprite.setOffset(
            (pConfig.frameWidth - pBodyWidth) / 2, 
            (pConfig.frameHeight / 2) - (20 / playerScale)
          );
          rSprite.play(`${charKey}_idle`);
          
          // Name tag
          const nameTag = this.add.text(0, 0, playerState.name || 'Player', {
            fontSize: '14px', fill: '#ffffff', backgroundColor: '#00000088'
          }).setOrigin(0.5).setDepth(200);

          const hpBar = this.add.graphics();
          hpBar.setDepth(200);

          const rpData = { 
            sprite: rSprite, 
            nameTag, 
            hpBar,
            charKey, 
            targetX: playerState.x || rSprite.x, 
            targetY: playerState.y || rSprite.y,
            hp: playerState.hp !== undefined ? playerState.hp : 100,
            maxHp: playerState.maxHp !== undefined ? playerState.maxHp : 100
          };
          this.remotePlayers.set(sessionId, rpData);

          // Register Host-Authoritative overlap for enemy projectiles hitting remote players
          if (multiplayer.isHost) {
            this.physics.add.overlap(this.enemyProjectiles, rSprite, (rpSprite, projectile) => {
              if (rpData.hp <= 0) return;
              
              const dmg = projectile.damage || 10;
              multiplayer.room.send("damage_player", { targetId: sessionId, damage: dmg, sourceX: projectile.x, sourceY: projectile.y });
              
              const explode = this.add.sprite(projectile.x, projectile.y, 'lunaria_explode');
              explode.play('lunaria_explode');
              explode.on('animationcomplete', () => explode.destroy());
              projectile.destroy();
            });
          }

          playerState.onChange(() => {
            if (playerState.x !== undefined) rpData.targetX = playerState.x;
            if (playerState.y !== undefined) rpData.targetY = playerState.y;
            
            if (playerState.hp !== undefined) {
              rpData.hp = playerState.hp;
              if (playerState.hp <= 0) {
                rSprite.body.enable = false; // Disable body on other clients too
                if (rSprite.alpha === 1) {
                  if (this.anims.exists(`${charKey}_death`)) {
                    rSprite.play(`${charKey}_death`, true);
                  }
                  this.tweens.add({ targets: rSprite, alpha: 0, duration: 1000 });
                }
              } else {
                this.tweens.killTweensOf(rSprite); // Stop any remote player fade-out tweens
                rSprite.body.enable = true; // Enable body on respawn
                rSprite.alpha = 1;
              }
            }
            if (playerState.maxHp !== undefined) rpData.maxHp = playerState.maxHp;
            
            if (playerState.anim && playerState.anim !== 'idle') {
               rSprite.play(playerState.anim, true);
            } else if (!playerState.isMoving) {
               rSprite.play(`${charKey}_idle`, true);
            }
            
            if (playerState.angle !== undefined) {
              rSprite.flipX = (playerState.angle < -90 || playerState.angle > 90);
            }
          });
        }
      });

      multiplayer.room.state.players.onRemove((playerState, sessionId) => {
        const rp = this.remotePlayers.get(sessionId);
        if (rp) {
          if (rp.sprite) rp.sprite.destroy();
          if (rp.nameTag) rp.nameTag.destroy();
          if (rp.hpBar) rp.hpBar.destroy();
          this.remotePlayers.delete(sessionId);
        }
      });

      // 2. Sync enemies from server (Joiner only)
      if (!multiplayer.isHost) {
        this.currentWaveIndex = 999; // Disable local waves triggers for Joiners

        multiplayer.room.state.enemies.onAdd((enemyState, id) => {
          const enemy = this.spawnEnemy(enemyState.x, enemyState.y, enemyState.type, enemyState.hp, 1, id);
          enemy.targetX = enemyState.x;
          enemy.targetY = enemyState.y;

          enemyState.onChange(() => {
            enemy.targetX = enemyState.x;
            enemy.targetY = enemyState.y;
            enemy.hp = enemyState.hp;
            enemy.maxHp = enemyState.maxHp;
            enemy.flipX = enemyState.flipX;
            if (enemyState.anim && enemy.anims.currentAnim?.key !== enemyState.anim) {
               if (!enemyState.anim.includes('attack')) {
                 enemy.play(enemyState.anim, true);
               }
            }
          });
        });

        multiplayer.room.state.enemies.onRemove((enemyState, id) => {
          const enemy = this.enemies.find(e => e.id === id);
          if (enemy && enemy.hp > 0) {
            enemy.hp = 0;
            this.damageEnemyLocal(enemy, 0, enemy.x, enemy.y);
          }
        });
      }

      // 3. Enemy Hit broadcast listener (everyone shows damage text, host applies damage)
      multiplayer.room.onMessage("enemy_hit", (data) => {
        const enemy = this.enemies.find(e => e.id === data.id);
        if (enemy) {
          this.showFloatingText(enemy.x, enemy.y - 40, `-${data.damage}`, '#ffffff');
          if (multiplayer.isHost) {
            this.damageEnemyLocal(enemy, data.damage, data.sourceX, data.sourceY);
          }
        }
      });

      // 4. Player Hit broadcast listener (everyone shows player damage, target reduces HP)
      multiplayer.room.onMessage("player_hit", (data) => {
        let targetSprite = null;
        if (data.targetId === multiplayer.room.sessionId) {
          targetSprite = this.player;
          this.showFloatingText(this.player.x, this.player.y - 40, `-${data.damage}`, '#ff5555');
          
          const nextHp = this.player.hp - data.damage;
          if (nextHp > 0 && !this.isDead) {
            this.isHurt = true;
            this.isAttacking = false; // Cancel attack if hit
            
            if (this.anims.exists(`${this.characterKey}_hurt`)) {
              this.player.play(`${this.characterKey}_hurt`, true);
            } else {
              this.time.delayedCall(200, () => { this.isHurt = false; });
            }
            
            this.player.setVelocity(0, 0);
            
            // Apply knockback
            if (data.sourceX !== undefined && data.sourceY !== undefined) {
              const angle = Phaser.Math.Angle.Between(data.sourceX, data.sourceY, this.player.x, this.player.y);
              this.player.setVelocity(Math.cos(angle) * 80, Math.sin(angle) * 80);
              setTimeout(() => { if (this.player && this.player.hp > 0 && !this.isDead) this.player.setVelocity(0); }, 150);
            }
          }
        } else {
          const rp = this.remotePlayers.get(data.targetId);
          if (rp) {
            targetSprite = rp.sprite;
            this.showFloatingText(targetSprite.x, targetSprite.y - 40, `-${data.damage}`, '#ff5555');
          }
        }
      });

      // 5. Player Healed broadcast listener
      multiplayer.room.onMessage("player_healed", (data) => {
        let targetSprite = null;
        if (data.targetId === multiplayer.room.sessionId) {
          targetSprite = this.player;
          this.showFloatingText(this.player.x, this.player.y - 40, `+${data.amount}`, '#4ade80');
        } else {
          const rp = this.remotePlayers.get(data.targetId);
          if (rp) {
            targetSprite = rp.sprite;
            this.showFloatingText(targetSprite.x, targetSprite.y - 40, `+${data.amount}`, '#4ade80');
          }
        }

        if (targetSprite && targetSprite.active && targetSprite.alpha > 0) {
          const healEffect = this.add.sprite(targetSprite.x, targetSprite.y, 'monk_heal_effect');
          healEffect.setDepth(targetSprite.depth + 1);
          healEffect.play('monk_heal_effect');
          healEffect.on('animationcomplete', () => { healEffect.destroy(); });
        }
      });

      // 6. Enemy attack event listener (play attack animations on remote client)
      multiplayer.room.onMessage("enemy_attacked", (data) => {
        const enemy = this.enemies.find(e => e.id === data.id);
        if (enemy) {
          enemy.play(data.anim, true);
        }
      });

      // 7. Projectile spawn event listener (for remote client visual sync)
      multiplayer.room.onMessage("projectile_spawned", (data) => {
        const projectile = this.enemyProjectiles.create(data.x, data.y, 'lunaria_moving');
        projectile.play('lunaria_moving');
        projectile.setCircle(15, projectile.width / 2 - 15, projectile.height / 2 - 15);
        projectile.rotation = data.angle;
        projectile.damage = data.damage;
        projectile.setVelocity(Math.cos(data.angle) * data.speed, Math.sin(data.angle) * data.speed);
      });

      // 8. Local player state HP listener (absolute source of truth)
      const localPlayerState = multiplayer.room.state.players.get(multiplayer.room.sessionId);
      if (localPlayerState) {
        localPlayerState.onChange(() => {
          if (localPlayerState.maxHp !== undefined) {
            this.playerMaxHp = localPlayerState.maxHp;
          }
          if (localPlayerState.hp !== undefined) {
            this.player.hp = localPlayerState.hp;
            if (this.player.hp <= 0 && !this.isDead) {
              this.checkPlayerDeath();
            } else if (this.player.hp > 0 && this.isDead) {
              this.resuscitatePlayer();
            }
          }
        });
      }

      // 9. Player projectile spawn listener (for remote client visual sync)
      multiplayer.room.onMessage("player_projectile_spawned", (data) => {
        const arrow = this.projectiles.create(data.x, data.y, 'arrow');
        arrow.setCircle(10, arrow.width / 2 - 10, arrow.height / 2 - 10);
        arrow.rotation = data.angle;
        arrow.damage = data.damage;
        arrow.setVelocity(Math.cos(data.angle) * data.speed, Math.sin(data.angle) * data.speed);
        arrow.setDepth(50);
        
        this.time.delayedCall(2000, () => {
          if (arrow && arrow.scene) arrow.destroy();
        });
      });
    }
  }

  update() {
    if (this.isGameOver) return;

    // Clean up dead enemies from logic array
    this.enemies = this.enemies.filter(enemy => {
      return enemy.hp > 0 || enemy.anims.isPlaying;
    });

    // Count alive enemies for Wave progression (Host or Singleplayer only)
    if (!multiplayer.room || multiplayer.isHost) {
      const aliveEnemies = this.enemies.filter(e => e.hp > 0).length;
      if (aliveEnemies === 0 && this.currentWaveIndex < this.waves.length) {
        this.startWave(this.currentWaveIndex);
        this.currentWaveIndex++;
      }
    }

    // Draw Player HP Bar
    if (this.player.hp > 0) {
      this.drawHealthBar(this.playerHpBar, this.player.x - 20, this.player.y - 35, 40, 5, this.player.hp, this.playerMaxHp, 0x4ade80);
    } else {
      this.playerHpBar.clear();
    }

    this.isGuarding = false;

    let isActionTriggered = Phaser.Input.Keyboard.JustDown(this.spaceBar) || this.virtualActionTriggered;
    if (this.virtualActionTriggered) this.virtualActionTriggered = false;
    
    // Prevent ranged attacks if no target is in range and facing
    if (isActionTriggered && CHARACTER_CONFIG[this.characterKey].attackType === 'ranged') {
      let hasTarget = false;
      const maxRange = CHARACTER_CONFIG[this.characterKey].attackRange || 500;
      this.enemies.forEach(enemy => {
        if (enemy.hp <= 0) return;
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
        const isFacingEnemy = (this.player.flipX && enemy.x < this.player.x) || (!this.player.flipX && enemy.x > this.player.x);
        if (dist < maxRange && isFacingEnemy) {
          hasTarget = true;
        }
      });
      if (!hasTarget) isActionTriggered = false;
    }

    const isGuardTriggered = this.shiftKey.isDown || this.isBtnBDown;

    // Player Logic
    if (this.player.hp <= 0) {
      this.player.setVelocity(0);
    } else if (this.isHurt) {
      // Don't allow movement or attacking while hurt
    } else if (this.isAttacking) {
      this.player.setVelocity(0);
    } else if (this.characterKey === 'tank' && isGuardTriggered) {
      this.isGuarding = true;
      this.player.setVelocity(0);
      this.player.play(`${this.characterKey}_guard`, true);
    } else if (isActionTriggered) {
      this.isAttacking = true;
      let actionName = this.characterKey === 'monk' ? 'heal' : 'attack';
      if (this.characterKey === 'kael' || this.characterKey === 'lucifer' || this.characterKey === 'shifu' || this.characterKey === 'mystic') {
        actionName = Math.random() < 0.5 ? 'attack' : 'attack2';
      }
      this.player.play(`${this.characterKey}_${actionName}`, true);
      this.player.setVelocity(0);
      
      // Delay effect execution
      this.time.delayedCall(350, () => {
        if(this.isHurt || this.player.hp <= 0) return; // If got hit before action completes, cancel

        if (this.characterKey === 'monk') {
          // AoE Heal logic (Area of Effect)
          const healRadius = 150; // Jangkauan radius area heal
          const allies = [{ sprite: this.player, id: multiplayer.room ? multiplayer.room.sessionId : 'local' }];
          if (multiplayer.room) {
            this.remotePlayers.forEach((rp, sessionId) => {
              allies.push({ sprite: rp.sprite, id: sessionId });
            });
          }
          
          allies.forEach(ally => {
            let allyHp = 0;
            if (ally.id === (multiplayer.room ? multiplayer.room.sessionId : 'local')) {
              allyHp = this.player.hp;
            } else {
              const pState = multiplayer.room.state.players.get(ally.id);
              allyHp = pState ? pState.hp : 0;
            }
            if (allyHp <= 0) return;

            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, ally.sprite.x, ally.sprite.y);
            
            if (dist <= healRadius) {
              const healAmt = CHARACTER_CONFIG.monk.attack;
              
              if (multiplayer.room) {
                // Send heal event to server, it broadcasts player_healed to everyone
                multiplayer.room.send("heal_player", { targetId: ally.id, amount: healAmt });
              } else {
                // Single player mode heal
                this.player.hp += healAmt;
                if (this.player.hp > this.playerMaxHp) this.player.hp = this.playerMaxHp;
                this.showFloatingText(this.player.x, this.player.y - 40, `+${healAmt}`, '#4ade80');

                const healEffect = this.add.sprite(ally.sprite.x, ally.sprite.y, 'monk_heal_effect');
                healEffect.setDepth(ally.sprite.depth + 1);
                healEffect.play('monk_heal_effect');
                healEffect.on('animationcomplete', () => { healEffect.destroy(); });
              }
            }
          });
        } else if (CHARACTER_CONFIG[this.characterKey].attackType === 'ranged') {
          // Ranged attack logic
          let nearestEnemy = null;
          let minHpEnemyDist = Infinity;
          this.enemies.forEach(enemy => {
            if (enemy.hp <= 0) return;
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
            // Must face the enemy
            const isFacingEnemy = (this.player.flipX && enemy.x < this.player.x) || (!this.player.flipX && enemy.x > this.player.x);
            const maxRange = CHARACTER_CONFIG[this.characterKey].attackRange || 500;
            if (dist < maxRange && dist < minHpEnemyDist && isFacingEnemy) {
              minHpEnemyDist = dist;
              nearestEnemy = enemy;
            }
          });
          
          if (nearestEnemy) {
            const arrow = this.projectiles.create(this.player.x, this.player.y, 'arrow');
            arrow.setCircle(10, arrow.width / 2 - 10, arrow.height / 2 - 10);
            arrow.damage = CHARACTER_CONFIG[this.characterKey].attack;
            
            const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, nearestEnemy.x, nearestEnemy.y);
            arrow.rotation = angle;
            
            const speed = 600;
            arrow.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
            arrow.setDepth(50);
            
            if (multiplayer.room) {
              multiplayer.room.send("spawn_player_projectile", {
                x: this.player.x,
                y: this.player.y,
                angle: angle,
                speed: speed,
                damage: arrow.damage
              });
            }
            
            this.time.delayedCall(2000, () => {
              if (arrow && arrow.scene) arrow.destroy();
            });
          }
        } else {
          // Standard Attack logic
          this.enemies.forEach(enemy => {
            if (enemy.hp <= 0) return;
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
            // Must face the enemy
            const isFacingEnemy = (this.player.flipX && enemy.x < this.player.x) || (!this.player.flipX && enemy.x > this.player.x);
            if (dist < 45 && isFacingEnemy) {
              const dmg = CHARACTER_CONFIG[this.characterKey].attack;
              
              if (multiplayer.room) {
                // Just send to server, server broadcasts enemy_hit
                multiplayer.room.send("damage_enemy", { id: enemy.id, damage: dmg, sourceX: this.player.x, sourceY: this.player.y });
              } else {
                this.showFloatingText(enemy.x, enemy.y - 40, `-${dmg}`, '#ffffff');
                this.damageEnemyLocal(enemy, dmg, this.player.x, this.player.y);
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

      // HTML Virtual Joystick Logic
      if (this.joystickData && this.joystickData.active) {
        velocityX = this.joystickData.x * speed;
        velocityY = this.joystickData.y * speed;
        if (Math.abs(velocityX) > 0) this.player.flipX = velocityX < 0;
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
      
      if (enemy.nameTag) {
        enemy.nameTag.setPosition(enemy.x, enemy.y - 35);
      }

      if (multiplayer.room && !multiplayer.isHost) {
        // Joiners - Smooth position interpolation (lerp)
        if (enemy.targetX !== undefined) {
          enemy.x += (enemy.targetX - enemy.x) * 0.15;
          enemy.y += (enemy.targetY - enemy.y) * 0.15;
        }
        return; // Skip local AI simulation for Joiners
      }

      // 1. Find nearest alive player
      let targetPlayer = null;
      let minDistance = Infinity;
      
      const checkTarget = (p, hp) => {
        if (hp <= 0) return;
        const d = Phaser.Math.Distance.Between(p.x, p.y, enemy.x, enemy.y);
        if (d < minDistance) {
          minDistance = d;
          targetPlayer = p;
        }
      };
      
      checkTarget(this.player, this.player.hp);
      
      if (multiplayer.room) {
        this.remotePlayers.forEach((rp) => {
          checkTarget(rp.sprite, rp.hp);
        });
      }
      
      // If no alive player, set velocity to 0 and idle
      if (!targetPlayer) {
        enemy.setVelocity(0);
        enemy.isAttacking = false; // Reset attack lock if target died during attack animation
        if (!enemy.isHurt) enemy.play(`${enemy.type}_idle`, true);
        return;
      }

      if (enemy.isHurt) {
        // Just being pushed back or stunned, don't move or attack
        return;
      }

      const dist = Phaser.Math.Distance.Between(targetPlayer.x, targetPlayer.y, enemy.x, enemy.y);
      const eConfig = CHARACTER_CONFIG[enemy.type];
      const maxAttackRange = eConfig.attackRange || ((enemy.type === 'demon' || enemy.type === 'orc') ? 40 : 35);

      if (enemy.isAttacking) {
        enemy.setVelocity(0, 0);
      } else if (dist < maxAttackRange) {
        // Enemy attacks
        enemy.isAttacking = true;
        enemy.setVelocity(0, 0);
        let eAction = 'attack';
        if (this.anims.exists(`${enemy.type}_attack2`) && Math.random() < 0.5) {
          eAction = 'attack2';
        }
        const attackAnim = `${enemy.type}_${eAction}`;
        enemy.play(attackAnim, true);
        enemy.flipX = (enemy.x > targetPlayer.x);
        
        if (multiplayer.room) {
          multiplayer.room.send("enemy_attack", { id: enemy.id, anim: attackAnim });
        }
        
        // Delay attack hit or spawn projectile
        if (eConfig.attackType === 'ranged') {
          this.time.delayedCall(300, () => {
            if (targetPlayer && targetPlayer.active && enemy.hp > 0 && !enemy.isHurt) {
              const projectile = this.enemyProjectiles.create(enemy.x, enemy.y, 'lunaria_moving');
              projectile.play('lunaria_moving');
              projectile.setCircle(15, projectile.width / 2 - 15, projectile.height / 2 - 15);
              projectile.damage = eConfig.attack;
              const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, targetPlayer.x, targetPlayer.y);
              projectile.rotation = angle;
              const speed = 250;
              projectile.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
              
              if (multiplayer.room) {
                multiplayer.room.send("spawn_projectile", {
                  x: enemy.x,
                  y: enemy.y,
                  angle: angle,
                  speed: speed,
                  damage: eConfig.attack
                });
              }
            }
          });
        } else {
          this.time.delayedCall(300, () => {
            if (targetPlayer && targetPlayer.active && enemy.hp > 0 && !enemy.isHurt) {
              const currentDist = Phaser.Math.Distance.Between(targetPlayer.x, targetPlayer.y, enemy.x, enemy.y);
              if (currentDist < maxAttackRange + 15) {
                // Check if target is local player
                if (targetPlayer === this.player) {
                  const isFacingEnemy = (this.player.flipX && enemy.x < this.player.x) || (!this.player.flipX && enemy.x > this.player.x);
                  if (this.isGuarding && isFacingEnemy) {
                    // Ignore damage, repel enemy
                    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
                    enemy.setVelocity(Math.cos(angle) * 150, Math.sin(angle) * 150);
                    setTimeout(() => { if (enemy && enemy.hp > 0) enemy.setVelocity(0); }, 150);
                  } else {
                    const dmg = eConfig.attack;
                    
                    if (multiplayer.room) {
                      multiplayer.room.send("damage_player", { targetId: multiplayer.room.sessionId, damage: dmg, sourceX: enemy.x, sourceY: enemy.y });
                    } else {
                      this.player.hp -= dmg;
                      this.showFloatingText(this.player.x, this.player.y - 40, `-${dmg}`, '#ff5555');
                      
                      this.checkPlayerDeath();
                      if (this.player.hp > 0) {
                        this.isHurt = true;
                        if (this.anims.exists(`${this.characterKey}_hurt`)) {
                          this.player.play(`${this.characterKey}_hurt`, true);
                        } else {
                          this.time.delayedCall(200, () => { this.isHurt = false; });
                        }
                        this.isAttacking = false; // Cancel attack if hit

                        // Knockback for player
                        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
                        this.player.setVelocity(Math.cos(angle) * 80, Math.sin(angle) * 80);
                        setTimeout(() => { if (this.player && this.player.hp > 0 && !this.isDead) this.player.setVelocity(0); }, 150);
                      }
                    }
                  }
                } else {
                  // Damage remote player
                  let targetSessionId = null;
                  this.remotePlayers.forEach((rp, sessionId) => {
                    if (rp.sprite === targetPlayer) targetSessionId = sessionId;
                  });
                  if (targetSessionId) {
                    const dmg = eConfig.attack;
                    multiplayer.room.send("damage_player", { targetId: targetSessionId, damage: dmg, sourceX: enemy.x, sourceY: enemy.y });
                  }
                }
              }
            }
          });
        }
      } else if (dist < 350) {
        // Follow player
        this.physics.moveToObject(enemy, targetPlayer, CHARACTER_CONFIG[enemy.type].speed);
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
      const mapW = 90;
      const mapH = 90;
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

      const minimapPlayerX = mapX + (this.player.x * scaleX);
      const minimapPlayerY = mapY + (this.player.y * scaleY);
      this.minimapGraphics.fillStyle(0x00ff00, 1);
      this.minimapGraphics.fillCircle(minimapPlayerX, minimapPlayerY, 3);
    }

    if (this.rangeIndicator && this.player) {
      this.rangeIndicator.setPosition(this.player.x, this.player.y);
    }
    
    // Sync to Multiplayer
    if (multiplayer.room) {
      // 1. Lerp remote players' positions smoothly on local client
      this.remotePlayers.forEach((rp) => {
        if (rp.sprite && rp.sprite.active) {
          rp.sprite.x += (rp.targetX - rp.sprite.x) * 0.15;
          rp.sprite.y += (rp.targetY - rp.sprite.y) * 0.15;
          if (rp.nameTag) {
            rp.nameTag.setPosition(rp.sprite.x, rp.sprite.y - 45);
          }
          if (rp.hpBar) {
            if (rp.hp > 0) {
              this.drawHealthBar(rp.hpBar, rp.sprite.x - 20, rp.sprite.y - 35, 40, 5, rp.hp, rp.maxHp, 0x4ade80);
            } else {
              rp.hpBar.clear();
            }
          }
        }
      });

      // 2. Local player move sync
      if (this.player.hp > 0 || this.isDead) {
        let currentAnim = 'idle';
        if (this.player.anims.currentAnim) {
           currentAnim = this.player.anims.currentAnim.key;
        }
        const isMoving = this.player.body.velocity.x !== 0 || this.player.body.velocity.y !== 0;
        let angle = 0;
        if (this.player.flipX) angle = 180;
        
        multiplayer.sendMove(this.player.x, this.player.y, 0, angle, currentAnim, isMoving, this.player.hp, this.playerMaxHp);
      }

      // 3. Host enemy sync to server
      if (multiplayer.isHost) {
        const enemyData = this.enemies
          .filter(e => e.active && e.hp > 0)
          .map(e => ({
            id: e.id,
            type: e.type,
            x: e.x,
            y: e.y,
            hp: e.hp,
            maxHp: e.maxHp,
            anim: e.anims.currentAnim ? e.anims.currentAnim.key : 'walk',
            flipX: e.flipX
          }));
        multiplayer.room.send("host_update_enemies", enemyData);
      }
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
    // Show HTML controls only on mobile devices
    const isTouch = this.sys.game.device.os.android || this.sys.game.device.os.iOS || this.sys.game.device.input.touch;
    const controls = document.getElementById('virtual-controls');
    
    if (controls && isTouch) {
      controls.style.display = 'flex';
      this.setupHTMLControls();
    }

    // Minimap Graphics
    this.minimapGraphics = this.add.graphics();
    this.minimapGraphics.setScrollFactor(0);
    this.minimapGraphics.setDepth(99);
  }

  setupHTMLControls() {
    this.joystickData = { active: false, x: 0, y: 0 };
    
    const base = document.getElementById('joystick-base');
    const stick = document.getElementById('joystick-stick');
    const zone = document.getElementById('joystick-zone');
    
    let baseRect = base.getBoundingClientRect();
    window.addEventListener('resize', () => { baseRect = base.getBoundingClientRect(); });

    const handleTouch = (e) => {
      e.preventDefault();
      const touch = e.touches[0] || e.changedTouches[0];
      if (!touch) return;
      
      const centerX = baseRect.left + baseRect.width / 2;
      const centerY = baseRect.top + baseRect.height / 2;
      
      let dx = touch.clientX - centerX;
      let dy = touch.clientY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxRadius = baseRect.width / 2;
      
      if (distance > maxRadius) {
        const ratio = maxRadius / distance;
        dx *= ratio;
        dy *= ratio;
      }
      
      stick.style.transform = `translate(${dx}px, ${dy}px)`;
      stick.style.transition = 'none';
      
      this.joystickData.x = dx / maxRadius;
      this.joystickData.y = dy / maxRadius;
      this.joystickData.active = true;
    };
    
    zone.addEventListener('touchstart', (e) => { baseRect = base.getBoundingClientRect(); handleTouch(e); }, { passive: false });
    zone.addEventListener('touchmove', handleTouch, { passive: false });
    
    const endTouch = () => {
      stick.style.transform = `translate(0px, 0px)`;
      stick.style.transition = 'transform 0.1s ease-out';
      this.joystickData.active = false;
      this.joystickData.x = 0;
      this.joystickData.y = 0;
    };
    
    zone.addEventListener('touchend', endTouch);
    zone.addEventListener('touchcancel', endTouch);
    
    // Action Buttons
    const btnA = document.getElementById('btn-attack');
    const btnB = document.getElementById('btn-skill');
    
    if (this.characterKey === 'tank') {
      btnB.style.display = 'block';
    } else {
      btnB.style.display = 'none';
    }
    
    btnA.addEventListener('touchstart', (e) => { e.preventDefault(); this.virtualActionTriggered = true; this.isBtnADown = true; }, { passive: false });
    btnA.addEventListener('touchend', (e) => { e.preventDefault(); this.isBtnADown = false; });
    
    btnB.addEventListener('touchstart', (e) => { e.preventDefault(); this.isBtnBDown = true; }, { passive: false });
    btnB.addEventListener('touchend', (e) => { e.preventDefault(); this.isBtnBDown = false; });
  }

  // ── Helper to update hitbox dynamically based on character and animation ──
  updateHitboxForAnim(sprite, charKey, animKey) {
    if (!sprite.body) return;
    
    const config = CHARACTER_CONFIG[charKey];
    if (!config) return;

    const baseScale = config.scale || 1;
    const extraScale = sprite.extraScale || 1; // used by enemies that are spawned bigger
    const totalScale = baseScale * extraScale;

    const hitboxCfg = this.cache.json.get('hitbox_config') || {};
    const charHitboxes = hitboxCfg[charKey] || {};
    
    // Fallback order: Specific Anim -> 'idle' Anim -> Default Formula
    const hbx = charHitboxes[animKey] || charHitboxes['idle'];
    
    let bodyW, bodyH, offX, offY;
    if (hbx) {
      bodyW = hbx.bodyW / extraScale;
      bodyH = hbx.bodyH / extraScale;
      offX = hbx.offsetX / extraScale;
      offY = hbx.offsetY / extraScale;
    } else {
      bodyW = 30 / totalScale;
      bodyH = 40 / totalScale;
      offX = (config.frameWidth - bodyW) / 2;
      offY = (config.frameHeight / 2) - (20 / totalScale);
    }

    sprite.setSize(bodyW, bodyH);
    sprite.setOffset(offX, offY);
  }
}
