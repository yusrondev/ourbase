// Standalone Colyseus Server (v0.15 matching client protocol)
const { Server, Room } = require('colyseus');
const { Schema, MapSchema, defineTypes } = require('@colyseus/schema');
const http = require('http');

const PORT = 2567;

const CHARACTER_HPS = {
  lucien: 50,
  human: 120,
  soldier2: 120,
  monk: 50,
  tank: 200,
  lyra: 40,
  kael: 110,
  lucifer: 130,
  shifu: 100,
  mystic: 70
};

// ── Schema Definitions ────────────────────────────────────────────────────────
class Player extends Schema {}
defineTypes(Player, {
  id: "string",
  name: "string",
  character: "string",
  x: "number",
  y: "number",
  z: "number",
  angle: "number",
  anim: "string",
  isMoving: "boolean",
  isHost: "boolean",
  hp: "number",
  maxHp: "number",
});

class EnemyState extends Schema {}
defineTypes(EnemyState, {
  id: "string",
  type: "string",
  x: "number",
  y: "number",
  hp: "number",
  maxHp: "number",
  anim: "string",
  flipX: "boolean",
});

class GameRoomState extends Schema {
  constructor() {
    super();
    this.status = "LOBBY";
    this.mapName = "default";
    this.hostId = "";
    this.players = new MapSchema();
    this.enemies = new MapSchema();
  }
}
defineTypes(GameRoomState, {
  status: "string",
  mapName: "string",
  hostId: "string",
  players: { map: Player },
  enemies: { map: EnemyState },
});

// ── Room Definition ───────────────────────────────────────────────────────────
class GameRoom extends Room {
  onCreate(options) {
    // Generate a clean 4-digit numeric room code (e.g., 4829)
    this.roomId = Math.floor(1000 + Math.random() * 9000).toString();
    this.setState(new GameRoomState());

    this.onMessage("set_character", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && data && data.character) {
        player.character = data.character;
        const initialHp = CHARACTER_HPS[data.character] || 100;
        player.hp = initialHp;
        player.maxHp = initialHp;
      }
    });

    this.onMessage("respawn_player", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.hp = player.maxHp;
      }
    });

    this.onMessage("set_map", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && player.isHost && data && data.mapName) {
        this.state.mapName = data.mapName;
      }
    });

    this.onMessage("start_game", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player && player.isHost) {
        this.state.status = "PLAYING";
      }
    });

    this.onMessage("player_move", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && data) {
        if (data.x !== undefined) player.x = data.x;
        if (data.y !== undefined) player.y = data.y;
        if (data.z !== undefined) player.z = data.z;
        if (data.angle !== undefined) player.angle = data.angle;
        if (data.anim !== undefined) player.anim = data.anim;
        if (data.isMoving !== undefined) player.isMoving = data.isMoving;
      }
    });

    this.onMessage("host_update_enemies", (client, data) => {
      if (client.sessionId !== this.state.hostId) return;

      const activeIds = new Set();
      if (Array.isArray(data)) {
        data.forEach(enemyData => {
          activeIds.add(enemyData.id);
          let enemy = this.state.enemies.get(enemyData.id);
          if (!enemy) {
            enemy = new EnemyState();
            enemy.id = enemyData.id;
            enemy.type = enemyData.type;
            this.state.enemies.set(enemyData.id, enemy);
          }
          enemy.x = enemyData.x;
          enemy.y = enemyData.y;
          enemy.hp = enemyData.hp;
          enemy.maxHp = enemyData.maxHp;
          enemy.anim = enemyData.anim;
          enemy.flipX = enemyData.flipX;
        });
      }

      this.state.enemies.forEach((enemy, id) => {
        if (!activeIds.has(id)) {
          this.state.enemies.delete(id);
        }
      });
    });

    this.onMessage("damage_enemy", (client, data) => {
      // Broadcast damage event to everyone
      this.broadcast("enemy_hit", { id: data.id, damage: data.damage, sourceX: data.sourceX, sourceY: data.sourceY });
    });

    this.onMessage("damage_player", (client, data) => {
      const targetPlayer = this.state.players.get(data.targetId);
      if (targetPlayer) {
        targetPlayer.hp -= data.damage;
        if (targetPlayer.hp < 0) targetPlayer.hp = 0;
      }
      // Broadcast player damage event to everyone
      this.broadcast("player_hit", { targetId: data.targetId, damage: data.damage, sourceX: data.sourceX, sourceY: data.sourceY });
    });

    this.onMessage("heal_player", (client, data) => {
      const targetPlayer = this.state.players.get(data.targetId);
      if (targetPlayer) {
        targetPlayer.hp += data.amount;
        if (targetPlayer.hp > targetPlayer.maxHp) targetPlayer.hp = targetPlayer.maxHp;
      }
      // Broadcast heal event to everyone
      this.broadcast("player_healed", { healerId: client.sessionId, targetId: data.targetId, amount: data.amount });
    });

    this.onMessage("enemy_attack", (client, data) => {
      // Broadcast enemy attack to other clients
      this.broadcast("enemy_attacked", { id: data.id, anim: data.anim }, { except: client });
    });

    this.onMessage("spawn_projectile", (client, data) => {
      // Broadcast projectile spawn to other clients
      this.broadcast("projectile_spawned", data, { except: client });
    });

    this.onMessage("spawn_player_projectile", (client, data) => {
      // Broadcast player projectile spawn to other clients
      this.broadcast("player_projectile_spawned", data, { except: client });
    });
  }

  onJoin(client, options) {
    const player = new Player();
    player.id = client.sessionId;
    player.name = (options && options.name && options.name.trim()) 
      ? options.name.trim() 
      : `Player_${client.sessionId.substring(0, 4)}`;
    player.character = "human";
    player.x = 0; player.y = 0; player.z = 0;
    player.angle = 0; player.anim = "idle";
    player.isMoving = false;
    player.hp = 100;
    player.maxHp = 100;

    if (this.state.players.size === 0) {
      player.isHost = true;
      this.state.hostId = client.sessionId;
    } else {
      player.isHost = false;
    }

    this.state.players.set(client.sessionId, player);
    console.log(`[Colyseus] Player "${player.name}" (${client.sessionId}) joined room ${this.roomId}`);
  }

  onLeave(client) {
    console.log(`[Colyseus] Player (${client.sessionId}) left room ${this.roomId}`);
    this.state.players.delete(client.sessionId);

    if (this.state.hostId === client.sessionId) {
      const remaining = Array.from(this.state.players.keys());
      if (remaining.length > 0) {
        const newHostId = remaining[0];
        this.state.hostId = newHostId;
        const newHost = this.state.players.get(newHostId);
        if (newHost) newHost.isHost = true;
      } else {
        this.state.hostId = "";
      }
    }
  }

  onDispose() {
    console.log(`[Colyseus] Room ${this.roomId} disposed`);
  }
}

// ── Start Server ───────────────────────────────────────────────────────────────
const httpServer = http.createServer();
const gameServer = new Server({
  server: httpServer
});

gameServer.define('game_room', GameRoom);
gameServer.listen(PORT).then(() => {
  console.log(`[Colyseus] ✅ Game Server running on ws://localhost:${PORT}`);
}).catch(err => {
  console.error('[Colyseus] ❌ Failed to start server:', err);
  process.exit(1);
});
