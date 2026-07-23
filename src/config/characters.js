export const CHARACTER_CONFIG = {
  lucien: {
    name: 'Lucien',
    role: 'Assassin',
    description: 'Pembunuh bayangan lincah yang menyerang dengan kecepatan kilat dan memiliki daya serang tinggi.',
    folder: 'lucien',
    frameWidth: 128,
    frameHeight: 128,
    hp: 50,
    attack: 30,
    speed: 210,
    scale: 0.6,
    animations: {
      idle: { frames: 6, rate: 8, repeat: -1 },
      walk: { frames: 8, rate: 10, repeat: -1 },
      attack: { frames: 5, rate: 12, repeat: 0 },
      death: { frames: 4, rate: 8, repeat: 0 },
      hurt: { frames: 2, rate: 8, repeat: 0 }
    }
  },
  human: {
    name: 'Darius',
    role: 'Fighter',
    description: 'Pejuang garis depan bersenjata pedang besar. Menyeimbangkan ketahanan fisik dan daya hancur yang tinggi.',
    folder: 'human',
    frameWidth: 96,
    frameHeight: 96,
    hp: 120,
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
    name: 'Victor',
    role: 'Fighter',
    description: 'Elite soldier dengan daya tahan fisik dan daya hancur yang tinggi.',
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
      attack: { frames: 7, rate: 10, repeat: 0 },
      death: { frames: 4, rate: 8, repeat: 0 },
      hurt: { frames: 4, rate: 8, repeat: 0 }
    }
  },
  kaizer: {
    folder: 'kaizer',
    frameWidth: 250,
    frameHeight: 250,
    hp: 250,
    attack: 30,
    speed: 120,
    scale: 1,
    animations: {
      idle: { frames: 8, rate: 8, repeat: -1 },
      walk: { frames: 8, rate: 10, repeat: -1 },
      attack: { frames: 8, rate: 10, repeat: 0 },
      attack2: { frames: 8, rate: 10, repeat: 0 },
      death: { frames: 7, rate: 8, repeat: 0 },
      hurt: { frames: 3, rate: 8, repeat: 0 }
    }
  },
  monk: {
    name: 'Monk',
    role: 'Support',
    description: 'Holy monk berkekuatan spiritual. Mampu mengeluarkan area healing (Tombol A) untuk memulihkan HP rekan.',
    folder: 'monk',
    frameWidth: 192,
    frameHeight: 192,
    hp: 50,
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
    name: 'Valgor',
    role: 'Tank',
    description: 'Pelindung abadi dengan tameng baja raksasa. Menghalau seluruh kerusakan musuh lewat mode bertahan (Tombol B).',
    folder: 'tank',
    frameWidth: 192,
    frameHeight: 192,
    hp: 200,
    attack: 10,
    speed: 100,
    scale: 0.5,
    animations: {
      idle: { frames: 8, rate: 8, repeat: -1 },
      walk: { frames: 6, rate: 10, repeat: -1 },
      attack: { frames: 4, rate: 8, repeat: 0 },
      guard: { frames: 6, rate: 10, repeat: 0 }
    }
  },
  gondaf: {
    name: 'Gondaf',
    role: 'Marksman',
    description: 'Pemanah jitu yang mampu menyerang dari jarak jauh dengan presisi tinggi.',
    folder: 'gondaf',
    frameWidth: 64,
    frameHeight: 64,
    hp: 80,
    attack: 40,
    speed: 180,
    scale: 1,
    singleSpritesheet: 'all.png',
    attackType: 'ranged',
    animations: {
      idle: { start: 0, end: 4, rate: 8, repeat: -1 },
      walk: { start: 22, end: 29, rate: 10, repeat: -1 },
      attack: { start: 11, end: 21, rate: 12, repeat: 0 },
      hurt: { start: 33, end: 37, rate: 8, repeat: 0 },
      death: { start: 44, end: 49, rate: 8, repeat: 0 }
    }
  },
  kael: {
    name: 'Kael',
    role: 'Fighter',
    description: 'Petarung mematikan dengan kombo serangan',
    folder: 'kael',
    frameWidth: 180,
    frameHeight: 180,
    hp: 110,
    attack: 35,
    speed: 170,
    scale: 0.8,
    animations: {
      idle: { frames: 11, rate: 10, repeat: -1 },
      walk: { frames: 8, rate: 12, repeat: -1 },
      attack: { frames: 7, rate: 12, repeat: 0 },
      attack2: { frames: 7, rate: 12, repeat: 0 },
      hurt: { frames: 4, rate: 8, repeat: 0 },
      death: { frames: 11, rate: 8, repeat: 0 }
    }
  },
  lucifer: {
    name: 'Lucifer',
    role: 'Fighter',
    description: 'Penguasa kegelapan dengan kekuatan penghancur',
    folder: 'lucifer',
    frameWidth: 200,
    frameHeight: 200,
    hp: 130,
    attack: 40,
    speed: 160,
    scale: 0.8,
    animations: {
      idle: { frames: 4, rate: 8, repeat: -1 },
      walk: { frames: 8, rate: 12, repeat: -1 },
      attack: { frames: 4, rate: 12, repeat: 0 },
      attack2: { frames: 4, rate: 12, repeat: 0 },
      hurt: { frames: 3, rate: 8, repeat: 0 },
      death: { frames: 7, rate: 8, repeat: 0 }
    }
  },
  shifu: {
    name: 'Shifu',
    role: 'Monk',
    description: 'Guru bijaksana dengan kecepatan serangan luar biasa',
    folder: 'shifu',
    frameWidth: 200,
    frameHeight: 200,
    hp: 100,
    attack: 25,
    speed: 180,
    scale: 0.8,
    animations: {
      idle: { frames: 8, rate: 8, repeat: -1 },
      walk: { frames: 8, rate: 12, repeat: -1 },
      attack: { frames: 6, rate: 15, repeat: 0 },
      attack2: { frames: 6, rate: 15, repeat: 0 },
      hurt: { frames: 4, rate: 8, repeat: 0 },
      death: { frames: 6, rate: 8, repeat: 0 }
    }
  }
};
