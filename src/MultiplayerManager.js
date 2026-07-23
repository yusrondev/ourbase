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
  }

  static getInstance() {
    if (!MultiplayerManager.instance) {
      MultiplayerManager.instance = new MultiplayerManager();
    }
    return MultiplayerManager.instance;
  }

  async createRoom(name) {
    this.playerName = name || "Player";
    this.room = await this.client.create('game_room', { name: this.playerName });
    this.roomId = this.room.id;
    this.isHost = true;
    return this.room.id;
  }

  async joinRoom(roomId, name) {
    this.playerName = name || "Player";
    this.room = await this.client.joinById(roomId, { name: this.playerName });
    this.roomId = this.room.id;
    this.isHost = false;
  }

  setCharacter(character) {
    if (this.room) {
      this.room.send("set_character", { character });
    }
  }

  setMap(mapName) {
    if (this.room && this.isHost) {
      this.room.send("set_map", { mapName });
    }
  }

  startGame() {
    if (this.room && this.isHost) {
      this.room.send("start_game");
    }
  }

  sendMove(x, y, z, angle, anim, isMoving, hp, maxHp) {
    if (this.room) {
      this.room.send("player_move", { x, y, z, angle, anim, isMoving, hp, maxHp });
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
