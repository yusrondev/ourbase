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
    
    // Dynamically load projectiles defined in hitboxes.json
    this.load.once('filecomplete-json-hitbox_config', (key, type, data) => {
      for (const charKey in data) {
        for (const animKey in data[charKey]) {
          const proj = data[charKey][animKey].proj;
          if (proj && proj.enabled) {
            const getPath = (p) => p.startsWith('/public') ? p.replace('/public', '') : p;
            if (proj.animated && proj.path) {
              this.load.spritesheet(proj.texture + '_moving', getPath(proj.path), { frameWidth: proj.fw, frameHeight: proj.fh });
            } else if (proj.path) {
              this.load.image(proj.texture, getPath(proj.path));
            }
            if (proj.explodePath) {
              this.load.spritesheet(proj.texture + '_explode', getPath(proj.explodePath), { frameWidth: proj.efw, frameHeight: proj.efh });
            }
          }
        }
      }
    });

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
    // O key to toggle is kept, but text is hidden
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
      
      // Explosion effect if configured
      if (arrow.projConfig && arrow.projConfig.explodePath) {
        const explKey = arrow.projConfig.texture + '_explode';
        if (this.anims.exists(explKey)) {
          const anim = this.anims.get(explKey);
          if (anim && anim.frames && anim.frames.length > 0) {
            const explode = this.add.sprite(arrow.x, arrow.y, explKey);
            explode.play(explKey);
            explode.on('animationcomplete', () => explode.destroy());
          }
        }
      }
      
      arrow.destroy();
    });

    // Create projectile animations dynamically from hitboxes.json
    const hitboxes = this.cache.json.get('hitbox_config');
    if (hitboxes) {
      for (const charKey in hitboxes) {
        if (hitboxes[charKey].stats && CHARACTER_CONFIG[charKey]) {
          Object.assign(CHARACTER_CONFIG[charKey], hitboxes[charKey].stats);
        }
        for (const animKey in hitboxes[charKey]) {
          const proj = hitboxes[charKey][animKey].proj;
          if (proj && proj.enabled) {
            if (proj.animated && proj.path && !this.anims.exists(proj.texture + '_moving')) {
              this.anims.create({
                key: proj.texture + '_moving',
                frames: this.anims.generateFrameNumbers(proj.texture + '_moving', { start: 0, end: proj.fc - 1 }),
                frameRate: 12,
                repeat: -1
              });
            }
            if (proj.explodePath && !this.anims.exists(proj.texture + '_explode')) {
              this.anims.create({
                key: proj.texture + '_explode',
                frames: this.anims.generateFrameNumbers(proj.texture + '_explode', { start: 0, end: proj.efc - 1 }),
                frameRate: 15,
                repeat: 0
              });
            }
          }
        }
      }
    }

    
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

    // (Duplicate projectile overlap block removed)

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
      this.player.hasAttackedThisCycle = false;
      this.player.hitTargets = new Set();
    });

    this.player.on('animationupdate', (anim, frame) => {
      const parts = anim.key.split('_');
      if (parts.length >= 2 && anim.key.includes('attack')) {
        const animKey = parts.slice(1).join('_');
        this.processAttackHitbox(this.player, animKey, frame, true);
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
      
      let dmg = projectile.damage;
      if (this.isGuarding) {
        dmg = Math.max(1, Math.floor(dmg * 0.3));
      }

      if (multiplayer.room) {
        // Any client getting hit by a projectile tells the server
        multiplayer.room.send("damage_player", { targetId: multiplayer.room.sessionId, damage: dmg, sourceX: projectile.x, sourceY: projectile.y });
      } else {
        if (this.isGuarding) {
          player.hp -= dmg;
          this.showFloatingText(player.x, player.y - 40, `Blocked`, '#aaaaaa');
        } else {
          player.hp -= dmg;
          this.showFloatingText(player.x, player.y - 40, `-${dmg}`, '#ff0000');
          
          // Dramatic camera shake + zoom-out on damage
          this.cameras.main.shake(180, 0.008);
          if (this._camZoomTarget !== undefined) {
            this._camZoomTarget = this._camZoomBase - 0.07;
          }
          
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
      }
      
      // Explosion effect if configured
      // Play explosion effect if projConfig has an explodePath configured
      if (projectile.projConfig && projectile.projConfig.explodePath) {
        const explKey = projectile.projConfig.texture + '_explode';
        if (this.anims.exists(explKey)) {
          const anim = this.anims.get(explKey);
          if (anim && anim.frames && anim.frames.length > 0) {
            const explode = this.add.sprite(projectile.x, projectile.y, explKey);
            explode.play(explKey);
            explode.on('animationcomplete', () => explode.destroy());
          }
        }
      }
      projectile.destroy();
    });
    
    // 2. Camera Follows Player
    // 2. Smooth dramatic camera follow
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.15);
    this.cameras.main.setDeadzone(30, 20);

    // Camera state
    // this._camZoomBase = 1.15;
    // this._camZoomCurrent = 1.15;
    // this._camZoomTarget = 1.15;

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
        enemy.hasAttackedThisCycle = false;
        enemy.hitTargets = new Set();
      });

      enemy.on('animationupdate', (anim, frame) => {
        const parts = anim.key.split('_');
        if (parts.length >= 2 && anim.key.includes('attack')) {
          const animKey = parts.slice(1).join('_');
          this.processAttackHitbox(enemy, animKey, frame, false);
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
      [{ type: 'lunaria', x: 500, y: 400, scale: 1 }],
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
      [{ type: 'kaizer', x: 400, y: 400, hpOverride: 500, scale: 1.5 }]
      // Wave 6: Lunaria (Ranged Boss)
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
      if (this.respawnInterval) {
        clearInterval(this.respawnInterval);
        this.respawnInterval = null;
      }
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
        this.respawnReady = false;
        this.player.hp = 0;
        this.player.setVelocity(0);
        this.player.body.enable = false;
        
        if (this.anims.exists(`${this.characterKey}_death`)) {
          this.player.play(`${this.characterKey}_death`);
        }

        // Show Respawn Overlay
        const overlay = document.getElementById('respawn-overlay');
        const timerText = document.getElementById('respawn-timer');
        if (overlay && timerText) {
          overlay.style.display = 'flex';
          let cooldown = 5;
          timerText.innerText = cooldown;
          
          if (this.respawnInterval) clearInterval(this.respawnInterval);
          this.respawnInterval = setInterval(() => {
            cooldown--;
            if (timerText) timerText.innerText = cooldown;
            if (cooldown <= 0) {
              clearInterval(this.respawnInterval);
              this.respawnInterval = null;
              this.respawnReady = true;
              
              if (multiplayer.room) {
                multiplayer.room.send("respawn_player");
                
                // If the server's HP is ALREADY maxHp (e.g. from an old delayed packet, or heal),
                // the server won't broadcast an HP change, so we must revive locally right now!
                const localPlayerState = multiplayer.room.state.players.get(multiplayer.room.sessionId);
                if (localPlayerState && localPlayerState.hp >= this.playerMaxHp) {
                  this.resuscitatePlayer();
                }
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
                if (rSprite.active && rSprite.hp <= 0) {
                  if (this.anims.exists(`${charKey}_death`)) {
                    rSprite.play(`${charKey}_death`, true);
                  }
                  // No alpha fade, leave body visible
                }
              } else {
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
        const tex = data.projConfig && data.projConfig.texture ? data.projConfig.texture : 'lunaria_moving';
        const projectile = this.enemyProjectiles.create(data.x, data.y, tex);
        projectile.projConfig = data.projConfig;
        
        if (data.projConfig && data.projConfig.animated) {
          if (this.anims.exists(tex + '_moving')) {
            const anim = this.anims.get(tex + '_moving');
            if (anim && anim.frames && anim.frames.length > 0) {
              projectile.play(tex + '_moving');
            }
          }
        } else if (tex === 'lunaria_moving') {
          if (this.anims.exists('lunaria_moving')) {
            const anim = this.anims.get('lunaria_moving');
            if (anim && anim.frames && anim.frames.length > 0) {
              projectile.play('lunaria_moving');
            }
          }
        }
        
        const size = data.projConfig && data.projConfig.size !== undefined ? data.projConfig.size : 15;
        projectile.setCircle(size, projectile.width / 2 - size, projectile.height / 2 - size);
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
            // Ignore incomplete HP syncs while dead (e.g. late network packets)
            if (this.isDead && (!this.respawnReady || localPlayerState.hp < this.playerMaxHp)) {
              // Wait for the full maxHp state from respawn_player AND timer completion
            } else {
              this.player.hp = localPlayerState.hp;
              if (this.player.hp <= 0 && !this.isDead) {
                this.checkPlayerDeath();
              } else if (this.player.hp >= this.playerMaxHp && this.isDead && this.respawnReady) {
                this.resuscitatePlayer();
              }
            }
          }
        });
      }

      // 9. Player projectile spawn listener (for remote client visual sync)
      multiplayer.room.onMessage("player_projectile_spawned", (data) => {
        const tex = data.projConfig && data.projConfig.texture ? data.projConfig.texture : 'arrow';
        const arrow = this.projectiles.create(data.x, data.y, tex);
        arrow.projConfig = data.projConfig;
        
        if (data.projConfig && data.projConfig.animated) {
          if (this.anims.exists(tex + '_moving')) {
            const anim = this.anims.get(tex + '_moving');
            if (anim && anim.frames && anim.frames.length > 0) {
              arrow.play(tex + '_moving');
            }
          }
        }
        
        const size = data.projConfig && data.projConfig.size !== undefined ? data.projConfig.size : 10;
        arrow.setCircle(size, arrow.width / 2 - size, arrow.height / 2 - size);
        arrow.rotation = data.angle;
        arrow.damage = data.damage;
        arrow.setVelocity(Math.cos(data.angle) * data.speed, Math.sin(data.angle) * data.speed);
        arrow.setDepth(50);
        
        this.time.delayedCall(2000, () => {
          if (arrow && arrow.scene) arrow.destroy();
        });
      });

      // 10. Load custom projectiles dynamically from hitbox configuration
      const hitboxCfg = this.cache.json.get('hitbox_config') || {};
      let needLoad = false;
      Object.values(hitboxCfg).forEach(charAnims => {
        Object.values(charAnims).forEach(anim => {
          if (anim.proj && anim.proj.enabled) {
            const p = anim.proj;
            if (p.animated && p.path) {
              if (!this.textures.exists(p.texture)) {
                this.load.spritesheet(p.texture, p.path, { frameWidth: p.fw, frameHeight: p.fh });
                needLoad = true;
              }
            } else if (p.path) {
              if (!this.textures.exists(p.texture)) {
                this.load.image(p.texture, p.path);
                needLoad = true;
              }
            }
            if (p.explodePath && !this.textures.exists(p.texture + '_explode')) {
              this.load.spritesheet(p.texture + '_explode', p.explodePath, { frameWidth: p.efw, frameHeight: p.efh });
              needLoad = true;
            }
          }
        });
      });

      if (needLoad) {
        this.load.once('complete', () => {
          this.createCustomProjectileAnims(hitboxCfg);
        });
        this.load.start();
      } else {
        this.createCustomProjectileAnims(hitboxCfg);
      }
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

    // ── Smooth dramatic camera zoom lerp ──────────────────────────────
    if (this._camZoomCurrent !== undefined) {
      this._camZoomCurrent = Phaser.Math.Linear(this._camZoomCurrent, this._camZoomTarget, 0.07);
      this.cameras.main.setZoom(this._camZoomCurrent);
      // Slowly return to base zoom
      if (Math.abs(this._camZoomTarget - this._camZoomBase) > 0.005) {
        this._camZoomTarget = Phaser.Math.Linear(this._camZoomTarget, this._camZoomBase, 0.04);
      } else {
        this._camZoomTarget = this._camZoomBase;
      }
    }

    let isActionTriggered = Phaser.Input.Keyboard.JustDown(this.spaceBar) || this.virtualActionTriggered;
    if (this.virtualActionTriggered) this.virtualActionTriggered = false;
    
    // Auto-aim for ranged attacks
    if (isActionTriggered && CHARACTER_CONFIG[this.characterKey].attackType === 'ranged') {
      let closestEnemy = null;
      let closestDist = Infinity;
      const maxRange = CHARACTER_CONFIG[this.characterKey].attackRange || 500;
      
      this.enemies.forEach(enemy => {
        if (enemy.hp <= 0) return;
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
        if (dist < maxRange && dist < closestDist) {
          closestDist = dist;
          closestEnemy = enemy;
        }
      });
      
      if (closestEnemy) {
        // Auto aim: face the enemy and set as target
        this.player.setFlipX(closestEnemy.x < this.player.x);
        this.player.targetEnemy = closestEnemy;
      } else {
        // If no target in range, clear target and still allow attacking in facing direction
        this.player.targetEnemy = null;
      }
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
      
      // Dramatic zoom-in punch on attack
      if (this._camZoomTarget !== undefined) {
        this._camZoomTarget = this._camZoomBase + 0.06;
      }
      
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
            this.player.targetEnemy = nearestEnemy;
          }
        } else {
          // Melee attacks are now handled by animationupdate and processAttackHitbox
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
        
        enemy.targetEnemy = targetPlayer;
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
    const minimapEl = document.getElementById('html-minimap');
    const minimapEntities = document.getElementById('minimap-entities');
    
    if (minimapEl && minimapEntities) {
      minimapEl.style.display = 'block';
      const mapW = 120; // Match width in CSS
      const mapH = 90; // Match height in CSS
      const scaleX = mapW / this.WORLD_WIDTH;
      const scaleY = mapH / this.WORLD_HEIGHT;

      let html = '';
      
      // Enemies
      this.enemies.forEach(e => {
        if (e.active && e.hp > 0) {
          const ex = e.x * scaleX;
          const ey = e.y * scaleY;
          html += `<div class="minimap-dot minimap-enemy" style="left: ${ex}px; top: ${ey}px;"></div>`;
        }
      });
      
      // Player
      if (this.player && this.player.active) {
        const px = this.player.x * scaleX;
        const py = this.player.y * scaleY;
        html += `<div class="minimap-dot minimap-player" style="left: ${px}px; top: ${py}px;"></div>`;
      }
      
      minimapEntities.innerHTML = html;
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
      fontSize: '16px',
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

    // ── HTML MINIMAP CLEANUP ──
    const minimapEl = document.getElementById('html-minimap');
    if (minimapEl) minimapEl.style.display = 'none';
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

  // ── Helper to process frame-specific attack hitbox ──
  processAttackHitbox(attacker, animKey, frame, isPlayer) {
    if (!this.cache.json.has('hitbox_config')) return;
    const hitboxCfg = this.cache.json.get('hitbox_config');
    const charKey = isPlayer ? this.characterKey : attacker.type;
    
    const charHitboxes = hitboxCfg[charKey] || {};
    const conf = charHitboxes[animKey];
    if (!conf) return;

    const hitFrame = conf.attackFrame !== undefined ? conf.attackFrame : -1;
    // frame.index is 1-based in Phaser animations!
    if (hitFrame === -1 || frame.index !== hitFrame) return;

    if (attacker.hasAttackedThisCycle) return;
    attacker.hasAttackedThisCycle = true;

    const baseScale = CHARACTER_CONFIG[charKey]?.scale || 1;
    const extraScale = attacker.extraScale || 1;
    const totalScale = baseScale * extraScale;
    
    const aw = (conf.attackW || 40) * totalScale;
    const ah = (conf.attackH || 40) * totalScale;
    let aox = (conf.attackOx || 0) * totalScale;
    const aoy = (conf.attackOy || 0) * totalScale;

    const frameW = CHARACTER_CONFIG[charKey].frameWidth;
    const topLeftX = attacker.x - (frameW * totalScale) / 2;
    const topLeftY = attacker.y - (CHARACTER_CONFIG[charKey].frameHeight * totalScale) / 2;

    let hitboxX;
    if (attacker.flipX) {
        hitboxX = topLeftX + (frameW * totalScale) - aox - aw;
    } else {
        hitboxX = topLeftX + aox;
    }
    const hitboxY = topLeftY + aoy;

    const attackRect = new Phaser.Geom.Rectangle(hitboxX, hitboxY, aw, ah);

    // Debug Hitbox
    if (this.physics.world.drawDebug) {
      const gfx = this.add.graphics();
      gfx.lineStyle(2, 0xff0000);
      gfx.strokeRect(attackRect.x, attackRect.y, attackRect.width, attackRect.height);
      this.time.delayedCall(200, () => gfx.destroy());
    }

    const dmg = CHARACTER_CONFIG[charKey].attack || 10;

    const projConfig = conf.proj && conf.proj.enabled ? conf.proj : null;

    if (projConfig || CHARACTER_CONFIG[charKey].attackType === 'ranged') {
      const spawnX = attackRect.x + attackRect.width / 2;
      const spawnY = attackRect.y + attackRect.height / 2;
      
      let targetX = spawnX + (attacker.flipX ? -100 : 100);
      let targetY = spawnY;
      
      if (attacker.targetEnemy && attacker.targetEnemy.active) {
        targetX = attacker.targetEnemy.x;
        targetY = attacker.targetEnemy.y;
      }
      
      const angle = Phaser.Math.Angle.Between(spawnX, spawnY, targetX, targetY);
      
      if (isPlayer) {
        const tex = projConfig ? projConfig.texture : 'arrow';
        const arrow = this.projectiles.create(spawnX, spawnY, tex);
        arrow.projConfig = projConfig;
        arrow.damage = dmg;
        arrow.rotation = angle;
        
        const speed = projConfig && projConfig.speed !== undefined ? projConfig.speed : 600;
        const size = projConfig && projConfig.size !== undefined ? projConfig.size : 10;
        
        arrow.setCircle(size, arrow.width / 2 - size, arrow.height / 2 - size);
        arrow.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        arrow.setDepth(50);
        
        if (projConfig && projConfig.animated) {
          if (this.anims.exists(tex + '_moving')) {
            const anim = this.anims.get(tex + '_moving');
            if (anim && anim.frames && anim.frames.length > 0) {
              arrow.play(tex + '_moving');
            }
          }
        }
        
        if (multiplayer.room) {
          multiplayer.room.send("spawn_player_projectile", { x: spawnX, y: spawnY, angle: angle, speed: speed, damage: dmg, projConfig: projConfig });
        }
        this.time.delayedCall(2000, () => { if (arrow && arrow.scene) arrow.destroy(); });
      } else {
        const tex = projConfig ? projConfig.texture : 'lunaria_moving';
        const projectile = this.enemyProjectiles.create(spawnX, spawnY, tex);
        projectile.projConfig = projConfig;
        projectile.damage = dmg;
        projectile.rotation = angle;
        
        const speed = projConfig && projConfig.speed !== undefined ? projConfig.speed : 250;
        const size = projConfig && projConfig.size !== undefined ? projConfig.size : 15;
        
        projectile.setCircle(size, projectile.width / 2 - size, projectile.height / 2 - size);
        projectile.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        
        if (projConfig && projConfig.animated) {
          if (this.anims.exists(tex + '_moving')) {
            const anim = this.anims.get(tex + '_moving');
            if (anim && anim.frames && anim.frames.length > 0) {
              projectile.play(tex + '_moving');
            }
          }
        } else if (tex === 'lunaria_moving') {
          if (this.anims.exists('lunaria_moving')) {
            const anim = this.anims.get('lunaria_moving');
            if (anim && anim.frames && anim.frames.length > 0) {
              projectile.play('lunaria_moving');
            }
          }
        }
        
        if (multiplayer.room) {
          multiplayer.room.send("spawn_projectile", { x: spawnX, y: spawnY, angle: angle, speed: speed, damage: dmg, projConfig: projConfig });
        }
        this.time.delayedCall(3000, () => { if (projectile && projectile.scene) projectile.destroy(); });
      }
      return;
    }

    if (isPlayer) {
      // Player attacks enemies
      this.enemies.forEach(enemy => {
        if (enemy.hp <= 0) return;
        const enemyRect = enemy.body ? new Phaser.Geom.Rectangle(enemy.body.x, enemy.body.y, enemy.body.width, enemy.body.height) : enemy.getBounds();
        if (Phaser.Geom.Intersects.RectangleToRectangle(attackRect, enemyRect)) {
          if (!attacker.hitTargets) attacker.hitTargets = new Set();
          if (attacker.hitTargets.has(enemy)) return;
          attacker.hitTargets.add(enemy);

          if (multiplayer.room) {
            multiplayer.room.send("damage_enemy", { id: enemy.id, damage: dmg, sourceX: attacker.x, sourceY: attacker.y });
          } else {
            this.showFloatingText(enemy.x, enemy.y - 40, `-${dmg}`, '#ffffff');
            this.damageEnemyLocal(enemy, dmg, attacker.x, attacker.y);
          }
        }
      });
    } else {
      // Enemy attacks player
      if (this.player.hp > 0 && !this.player.isHurt) {
        const playerRect = this.player.body ? new Phaser.Geom.Rectangle(this.player.body.x, this.player.body.y, this.player.body.width, this.player.body.height) : this.player.getBounds();
        if (Phaser.Geom.Intersects.RectangleToRectangle(attackRect, playerRect)) {
          if (!attacker.hitTargets) attacker.hitTargets = new Set();
          if (attacker.hitTargets.has(this.player)) return;
          attacker.hitTargets.add(this.player);

          const isFacingEnemy = (this.player.flipX && attacker.x < this.player.x) || (!this.player.flipX && attacker.x > this.player.x);
          if (this.isGuarding && isFacingEnemy) {
            const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, attacker.x, attacker.y);
            attacker.setVelocity(Math.cos(angle) * 150, Math.sin(angle) * 150);
            setTimeout(() => { if (attacker && attacker.hp > 0) attacker.setVelocity(0); }, 150);
            return;
          }

          if (multiplayer.room) {
            multiplayer.room.send("damage_player", { targetId: multiplayer.room.sessionId, damage: dmg, sourceX: attacker.x, sourceY: attacker.y });
          } else {
            this.player.hp -= dmg;
            this.showFloatingText(this.player.x, this.player.y - 40, `-${dmg}`, '#ff0000');
            this.checkPlayerDeath();
            if (this.player.hp > 0) {
              this.isHurt = true;
              if (this.anims.exists(`${this.characterKey}_hurt`)) {
                this.player.play(`${this.characterKey}_hurt`, true);
              } else {
                this.time.delayedCall(200, () => { this.isHurt = false; });
              }
              this.isAttacking = false;
              const angle = Phaser.Math.Angle.Between(attacker.x, attacker.y, this.player.x, this.player.y);
              this.player.setVelocity(Math.cos(angle) * 80, Math.sin(angle) * 80);
              setTimeout(() => { if (this.player && this.player.hp > 0 && !this.isDead) this.player.setVelocity(0); }, 150);
            }
          }
        }
      }
    }
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

  createCustomProjectileAnims(hitboxCfg) {
    Object.values(hitboxCfg).forEach(charAnims => {
      Object.values(charAnims).forEach(anim => {
        if (anim.proj && anim.proj.enabled) {
          const p = anim.proj;
          if (p.animated && this.textures.exists(p.texture) && !this.anims.exists(p.texture + '_moving')) {
            const frames = this.anims.generateFrameNumbers(p.texture, { start: 0, end: p.fc - 1 });
            if (frames && frames.length > 0) {
              this.anims.create({
                key: p.texture + '_moving',
                frames: frames,
                frameRate: 12,
                repeat: -1
              });
            }
          }
          if (p.explodePath && this.textures.exists(p.texture + '_explode') && !this.anims.exists(p.texture + '_explode')) {
            const frames = this.anims.generateFrameNumbers(p.texture + '_explode', { start: 0, end: p.efc - 1 });
            if (frames && frames.length > 0) {
              this.anims.create({
                key: p.texture + '_explode',
                frames: frames,
                frameRate: 15,
                repeat: 0
              });
            }
          }
        }
      });
    });
  }
}
