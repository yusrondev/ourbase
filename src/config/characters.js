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
  lunaria: {
    folder: 'lunaria',
    frameWidth: 140,
    frameHeight: 140,
    hp: 180,
    attack: 40,
    speed: 90,
    scale: 1,
    attackType: 'ranged',
    attackRange: 400,
    animations: {
      idle: { frames: 10, rate: 8, repeat: -1 },
      walk: { frames: 8, rate: 10, repeat: -1 },
      attack: { frames: 13, rate: 12, repeat: 0 },
      death: { frames: 18, rate: 10, repeat: 0 },
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
  lyra: {
    name: 'Lyra',
    role: 'Marksman',
    description: 'Pemanah jitu yang mampu menyerang dari jarak jauh dengan presisi tinggi.',
    folder: 'lyra',
    frameWidth: 100,
    frameHeight: 100,
    hp: 40,
    attack: 45,
    speed: 80,
    scale: 1,
    attackType: 'ranged',
    attackRange: 150,
    animations: {
      idle: { frames: 10, rate: 8, repeat: -1 },
      walk: { frames: 8, rate: 10, repeat: -1 },
      attack: { frames: 6, rate: 12, repeat: 0 },
      hurt: { frames: 3, rate: 8, repeat: 0 },
      death: { frames: 10, rate: 8, repeat: 0 }
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
    role: 'Assassin',
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
  },
  mystic: {
    name: 'Mystic',
    role: 'Mage',
    description: 'Penyihir handal dengan serangan sihir jarak dekat yang mematikan',
    folder: 'mystic',
    frameWidth: 231,
    frameHeight: 190,
    hp: 70,
    attack: 45,
    speed: 80,
    scale: 0.6,
    animations: {
      idle: { frames: 6, rate: 8, repeat: -1 },
      walk: { frames: 8, rate: 12, repeat: -1 },
      attack: { frames: 8, rate: 12, repeat: 0 },
      attack2: { frames: 8, rate: 12, repeat: 0 },
      hurt: { frames: 4, rate: 8, repeat: 0 },
      death: { frames: 7, rate: 8, repeat: 0 }
    }
  }
};
