export const CHARACTER_CONFIG = {
  human: {
    folder: 'human',
    frameWidth: 96,
    frameHeight: 96,
    hp: 100,
    attack: 20,
    speed: 150,
    scale: 2,
    animations: {
      idle: { frames: 6, rate: 8, repeat: -1 },
      walk: { frames: 8, rate: 10, repeat: -1 },
      attack: { frames: 6, rate: 12, repeat: 0 },
      death: { frames: 6, rate: 8, repeat: 0 },
      hurt: { frames: 4, rate: 8, repeat: 0 }
    }
  },
  soldier2: {
    folder: 'soldier2',
    frameWidth: 100,
    frameHeight: 100,
    hp: 120,
    attack: 25,
    speed: 130,
    scale: 2,
    animations: {
      idle: { frames: 6, rate: 8, repeat: -1 },
      walk: { frames: 8, rate: 10, repeat: -1 },
      attack: { frames: 6, rate: 12, repeat: 0 },
      death: { frames: 4, rate: 8, repeat: 0 },
      hurt: { frames: 4, rate: 8, repeat: 0 }
    }
  },
  slime: {
    folder: 'slime',
    frameWidth: 96,
    frameHeight: 96,
    hp: 50,
    attack: 10,
    speed: 80,
    scale: 2,
    animations: {
      idle: { frames: 6, rate: 8, repeat: -1 },
      walk: { frames: 8, rate: 10, repeat: -1 },
      attack: { frames: 6, rate: 10, repeat: 0 },
      death: { frames: 6, rate: 8, repeat: 0 },
      hurt: { frames: 4, rate: 8, repeat: 0 }
    }
  },
  blood: {
    folder: 'blood',
    frameWidth: 100,
    frameHeight: 100,
    hp: 80,
    attack: 15,
    speed: 100,
    scale: 2,
    animations: {
      idle: { frames: 6, rate: 8, repeat: -1 },
      walk: { frames: 8, rate: 10, repeat: -1 },
      attack: { frames: 8, rate: 10, repeat: 0 },
      death: { frames: 4, rate: 8, repeat: 0 },
      hurt: { frames: 4, rate: 8, repeat: 0 }
    }
  },
  demon: {
    folder: 'demon',
    frameWidth: 100,
    frameHeight: 100,
    hp: 120,
    attack: 25,
    speed: 90,
    scale: 2,
    animations: {
      idle: { frames: 6, rate: 8, repeat: -1 },
      walk: { frames: 8, rate: 10, repeat: -1 },
      attack: { frames: 7, rate: 10, repeat: 0 },
      death: { frames: 4, rate: 8, repeat: 0 },
      hurt: { frames: 4, rate: 8, repeat: 0 }
    }
  },
  orc: {
    folder: 'orc',
    frameWidth: 100,
    frameHeight: 100,
    hp: 150,
    attack: 30,
    speed: 70,
    scale: 2,
    animations: {
      idle: { frames: 6, rate: 8, repeat: -1 },
      walk: { frames: 8, rate: 10, repeat: -1 },
      attack: { frames: 6, rate: 10, repeat: 0 },
      death: { frames: 4, rate: 8, repeat: 0 },
      hurt: { frames: 4, rate: 8, repeat: 0 }
    }
  },
  monk: {
    folder: 'monk',
    frameWidth: 192,
    frameHeight: 192,
    hp: 90,
    attack: 30, // We use this as healing power
    speed: 160,
    scale: 0.5,
    animations: {
      idle: { frames: 6, rate: 8, repeat: -1 },
      walk: { frames: 4, rate: 10, repeat: -1 },
      heal: { frames: 11, rate: 10, repeat: 0 },
      heal_effect: { frames: 11, rate: 10, repeat: 0 }
    }
  },
  tank: {
    folder: 'tank',
    frameWidth: 192,
    frameHeight: 192,
    hp: 200,
    attack: 25,
    speed: 100,
    scale: 0.5,
    animations: {
      idle: { frames: 8, rate: 8, repeat: -1 },
      walk: { frames: 6, rate: 10, repeat: -1 },
      attack: { frames: 4, rate: 8, repeat: 0 },
      guard: { frames: 6, rate: 10, repeat: 0 }
    }
  }
};
