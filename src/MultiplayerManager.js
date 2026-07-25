import * as Colyseus from 'colyseus.js';

export class MultiplayerManager {
  constructor() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; // Works for localhost:5173 (with proxy) and ngrok!
    this.client = new Colyseus.Client(`${protocol}//${host}/colyseus`);
    
    this.room = null;
    this.playerName = "Player";
    this.roomId = null;
    this.isHost = false;
    this.isLeaving = false;
  }

  static getInstance() {
    if (!MultiplayerManager.instance) {
      MultiplayerManager.instance = new MultiplayerManager();
    }
    return MultiplayerManager.instance;
  }

  async createRoom(name) {
    this.isLeaving = false;
    this.playerName = name || "Player";
    this.room = await this.client.create('game_room', { name: this.playerName });
    this.roomId = this.room.id;
    this.isHost = true;
    return this.room.id;
  }

  async joinRoom(roomId, name) {
    this.isLeaving = false;
    this.playerName = name || "Player";
    this.room = await this.client.joinById(roomId, { name: this.playerName });
    this.roomId = this.room.id;
    this.isHost = false;
  }

  // Returns true only when the room is open and not leaving
  canSend() {
    if (!this.room || this.isLeaving) return false;
    // Try to detect closed WebSocket in browser env
    try {
      // room.connection is the WebSocketTransport; .ws is the native WebSocket
      const ws = this.room.connection?.ws ?? this.room._transport?.ws;
      if (ws !== undefined && ws.readyState !== 1) return false;
    } catch (e) {}
    return true;
  }

  setCharacter(character) {
    if (this.canSend()) {
      this.room.send("set_character", { character });
    }
  }

  setMap(mapName) {
    if (this.canSend() && this.isHost) {
      this.room.send("set_map", { mapName });
    }
  }

  startGame() {
    if (this.canSend() && this.isHost) {
      this.room.send("start_game");
    }
  }

  sendMove(x, y, z, angle, anim, isMoving, hp, maxHp) {
    if (this.canSend()) {
      this.room.send("player_move", { x, y, z, angle, anim, isMoving, hp, maxHp });
    }
  }

  // Generic safe send — use this in GameScene for all room.send() calls
  safeSend(type, data) {
    if (this.canSend()) {
      this.room.send(type, data);
    }
  }

  leaveRoom() {
    if (this.room) {
      this.room.leave();
      this.room = null;
      this.roomId = null;
      this.isHost = false;
    }
  }
}

export const multiplayer = MultiplayerManager.getInstance();
