/**
 * MONSTER_OFFICIAL_ATTACKS.js
 * NetHack 5.0 C言語コア (monsters.h & monattk.h) から直接抽出した
 * 全モンスター公式攻撃定義マスター (Single Source of Truth)
 *
 * 各モンスターの攻撃種別 (AT_*), ダメージ属性 (AD_*), ダイス数 (n), ダイス面数 (d) を完全構造化
 */

export const MONSTER_OFFICIAL_ATTACKS = {
    "0": [
        {
            "type": "bite",
            "damage": "1d4"
        }
    ],
    "1": [
        {
            "type": "sting",
            "damage": "1d3",
            "effect": "poison"
        }
    ],
    "2": [
        {
            "type": "bite",
            "damage": "2d4"
        },
        {
            "type": "sting",
            "damage": "3d4",
            "effect": "poison"
        }
    ],
    "3": [
        {
            "type": "bite",
            "damage": "2d4"
        },
        {
            "type": "bite",
            "damage": "2d4",
            "effect": "fire"
        }
    ],
    "4": [
        {
            "type": "bite",
            "damage": "3d6"
        }
    ],
    "5": [
        {
            "type": "sting",
            "damage": "1d8",
            "effect": "poison"
        }
    ],
    "6": [],
    "7": [
        {
            "type": "touch",
            "damage": "1d8"
        }
    ],
    "8": [
        {
            "type": "touch",
            "damage": "2d4",
            "effect": "paralysis"
        }
    ],
    "9": [
        {
            "type": "bite",
            "damage": "1d2"
        },
        {
            "type": "touch",
            "effect": "stoning"
        }
    ],
    "10": [
        {
            "type": "bite",
            "damage": "1d3"
        },
        {
            "type": "touch",
            "effect": "stoning"
        }
    ],
    "11": [
        {
            "type": "gaze",
            "damage": "2d6",
            "effect": "fire"
        },
        {
            "type": "bite",
            "damage": "1d6"
        }
    ],
    "12": [
        {
            "type": "bite",
            "damage": "1d2"
        }
    ],
    "13": [
        {
            "type": "bite",
            "damage": "1d3"
        }
    ],
    "14": [
        {
            "type": "bite",
            "damage": "1d4"
        }
    ],
    "15": [
        {
            "type": "weapon",
            "damage": "2d4"
        }
    ],
    "16": [
        {
            "type": "bite",
            "damage": "1d6"
        }
    ],
    "17": [
        {
            "type": "bite",
            "damage": "1d6"
        }
    ],
    "18": [
        {
            "type": "bite",
            "damage": "1d6"
        }
    ],
    "19": [
        {
            "type": "bite",
            "damage": "2d4"
        }
    ],
    "20": [
        {
            "type": "bite",
            "damage": "2d4"
        }
    ],
    "21": [
        {
            "type": "weapon",
            "damage": "2d4"
        }
    ],
    "22": [
        {
            "type": "bite",
            "damage": "1d8"
        },
        {
            "type": "breath",
            "damage": "1d6",
            "effect": "cold"
        }
    ],
    "23": [
        {
            "type": "bite",
            "damage": "2d6"
        }
    ],
    "24": [
        {
            "type": "bite",
            "damage": "2d6"
        },
        {
            "type": "breath",
            "damage": "2d6",
            "effect": "cold"
        }
    ],
    "25": [
        {
            "type": "bite",
            "damage": "2d6"
        },
        {
            "type": "breath",
            "damage": "2d6",
            "effect": "fire"
        }
    ],
    "26": [
        {
            "type": "bite",
            "damage": "3d6"
        },
        {
            "type": "breath",
            "damage": "3d6",
            "effect": "fire"
        }
    ],
    "27": [
        {
            "type": "boom",
            "damage": "4d6"
        }
    ],
    "28": [],
    "29": [
        {
            "type": "explode",
            "damage": "4d6",
            "effect": "cold"
        }
    ],
    "30": [
        {
            "type": "explode",
            "damage": "4d6",
            "effect": "fire"
        }
    ],
    "31": [
        {
            "type": "explode",
            "damage": "4d6",
            "effect": "elec"
        }
    ],
    "32": [
        {
            "type": "bite",
            "damage": "1d6"
        }
    ],
    "33": [
        {
            "type": "bite",
            "damage": "1d6"
        }
    ],
    "34": [
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "bite",
            "damage": "1d8"
        }
    ],
    "35": [
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "bite",
            "damage": "1d10"
        }
    ],
    "36": [
        {
            "type": "claw",
            "damage": "1d6"
        },
        {
            "type": "claw",
            "damage": "1d6"
        },
        {
            "type": "bite",
            "damage": "1d10"
        }
    ],
    "37": [
        {
            "type": "bite",
            "damage": "2d4"
        }
    ],
    "38": [
        {
            "type": "claw",
            "damage": "2d4"
        },
        {
            "type": "claw",
            "damage": "2d4"
        },
        {
            "type": "bite",
            "damage": "1d10"
        }
    ],
    "39": [
        {
            "type": "claw",
            "damage": "4d4"
        },
        {
            "type": "claw",
            "damage": "4d4"
        },
        {
            "type": "bite",
            "damage": "2d10"
        }
    ],
    "40": [
        {
            "type": "claw",
            "damage": "1d6"
        },
        {
            "type": "claw",
            "damage": "1d6"
        },
        {
            "type": "bite",
            "damage": "1d4"
        },
        {
            "type": "claw",
            "effect": "curse"
        }
    ],
    "41": [
        {
            "type": "claw",
            "damage": "2d6"
        },
        {
            "type": "claw",
            "damage": "2d6"
        },
        {
            "type": "bite",
            "damage": "2d4"
        }
    ],
    "42": [
        {
            "type": "claw",
            "damage": "3d6"
        },
        {
            "type": "claw",
            "damage": "3d6"
        },
        {
            "type": "bite",
            "damage": "3d4"
        }
    ],
    "43": [
        {
            "type": "weapon",
            "damage": "1d6"
        }
    ],
    "44": [
        {
            "type": "weapon",
            "damage": "1d8"
        }
    ],
    "45": [
        {
            "type": "weapon",
            "damage": "2d4"
        }
    ],
    "46": [
        {
            "type": "weapon",
            "damage": "2d4"
        },
        {
            "type": "weapon",
            "damage": "2d4"
        }
    ],
    "47": [
        {
            "type": "weapon",
            "damage": "2d6"
        },
        {
            "type": "weapon",
            "damage": "2d6"
        }
    ],
    "48": [
        {
            "type": "weapon",
            "damage": "1d4"
        },
        {
            "type": "tentacle",
            "damage": "2d1",
            "effect": "brain_eat"
        },
        {
            "type": "tentacle",
            "damage": "2d1",
            "effect": "brain_eat"
        },
        {
            "type": "tentacle",
            "damage": "2d1",
            "effect": "brain_eat"
        }
    ],
    "49": [
        {
            "type": "weapon",
            "damage": "1d8"
        },
        {
            "type": "tentacle",
            "damage": "2d1",
            "effect": "brain_eat"
        },
        {
            "type": "tentacle",
            "damage": "2d1",
            "effect": "brain_eat"
        },
        {
            "type": "tentacle",
            "damage": "2d1",
            "effect": "brain_eat"
        },
        {
            "type": "tentacle",
            "damage": "2d1",
            "effect": "brain_eat"
        },
        {
            "type": "tentacle",
            "damage": "2d1",
            "effect": "brain_eat"
        }
    ],
    "50": [
        {
            "type": "claw",
            "damage": "1d3"
        },
        {
            "type": "claw",
            "damage": "1d3"
        },
        {
            "type": "bite",
            "damage": "1d4"
        }
    ],
    "51": [
        {
            "type": "bite",
            "damage": "1d3",
            "effect": "sleep"
        }
    ],
    "52": [
        {
            "type": "claw",
            "damage": "1d4"
        }
    ],
    "53": [
        {
            "type": "claw",
            "damage": "1d3"
        }
    ],
    "54": [
        {
            "type": "claw",
            "damage": "1d2",
            "effect": "drain_dex"
        },
        {
            "type": "claw",
            "damage": "1d2",
            "effect": "drain_dex"
        },
        {
            "type": "bite",
            "damage": "1d4"
        }
    ],
    "55": [
        {
            "type": "bite",
            "damage": "1d7"
        }
    ],
    "56": [],
    "57": [],
    "58": [
        {
            "type": "engulf",
            "damage": "3d6",
            "effect": "acid"
        }
    ],
    "59": [
        {
            "type": "weapon",
            "damage": "1d4"
        }
    ],
    "60": [
        {
            "type": "weapon",
            "damage": "1d6"
        }
    ],
    "61": [
        {
            "type": "weapon",
            "damage": "2d4"
        }
    ],
    "62": [
        {
            "type": "cast",
            "effect": "magic_spell"
        }
    ],
    "63": [
        {
            "type": "claw",
            "damage": "1d2",
            "effect": "steal_gold"
        }
    ],
    "64": [
        {
            "type": "claw",
            "damage": "3d4"
        }
    ],
    "65": [
        {
            "type": "claw",
            "damage": "3d4",
            "effect": "stick"
        }
    ],
    "66": [
        {
            "type": "claw",
            "damage": "3d6",
            "effect": "stick"
        },
        {
            "type": "claw",
            "damage": "3d6",
            "effect": "stick"
        }
    ],
    "67": [
        {
            "type": "claw",
            "effect": "steal_item"
        },
        {
            "type": "claw",
            "effect": "seduce"
        }
    ],
    "68": [
        {
            "type": "claw",
            "effect": "steal_item"
        },
        {
            "type": "claw",
            "effect": "seduce"
        }
    ],
    "69": [
        {
            "type": "claw",
            "effect": "steal_item"
        },
        {
            "type": "claw",
            "effect": "seduce"
        }
    ],
    "70": [
        {
            "type": "weapon",
            "damage": "1d4"
        }
    ],
    "71": [
        {
            "type": "weapon",
            "damage": "1d6"
        }
    ],
    "72": [
        {
            "type": "weapon",
            "damage": "1d8"
        }
    ],
    "73": [
        {
            "type": "weapon",
            "damage": "1d6"
        }
    ],
    "74": [
        {
            "type": "weapon",
            "damage": "1d6"
        }
    ],
    "75": [
        {
            "type": "weapon",
            "damage": "1d8"
        }
    ],
    "76": [
        {
            "type": "cast",
            "effect": "magic_spell"
        }
    ],
    "77": [
        {
            "type": "weapon",
            "damage": "2d4"
        },
        {
            "type": "weapon",
            "damage": "2d4"
        }
    ],
    "78": [
        {
            "type": "bite",
            "damage": "2d6"
        }
    ],
    "79": [
        {
            "type": "bite",
            "damage": "3d6"
        }
    ],
    "80": [
        {
            "type": "bite",
            "damage": "4d6"
        }
    ],
    "81": [
        {
            "type": "claw",
            "damage": "1d3"
        },
        {
            "type": "bite",
            "damage": "1d3"
        },
        {
            "type": "bite",
            "damage": "1d8"
        }
    ],
    "82": [
        {
            "type": "butt",
            "damage": "4d12"
        },
        {
            "type": "bite",
            "damage": "2d6"
        }
    ],
    "83": [
        {
            "type": "claw",
            "damage": "2d6"
        },
        {
            "type": "bite",
            "damage": "2d6"
        },
        {
            "type": "claw",
            "damage": "2d6"
        }
    ],
    "84": [
        {
            "type": "bite",
            "damage": "3d6"
        }
    ],
    "85": [
        {
            "type": "claw",
            "damage": "2d8"
        }
    ],
    "86": [
        {
            "type": "claw",
            "damage": "5d4"
        },
        {
            "type": "claw",
            "damage": "5d4"
        }
    ],
    "87": [
        {
            "type": "butt",
            "damage": "4d8"
        },
        {
            "type": "butt",
            "damage": "4d8"
        }
    ],
    "88": [
        {
            "type": "bite",
            "damage": "1d3"
        }
    ],
    "89": [
        {
            "type": "bite",
            "damage": "1d3"
        }
    ],
    "90": [
        {
            "type": "bite",
            "damage": "2d4",
            "effect": "drain_con"
        }
    ],
    "91": [
        {
            "type": "weapon",
            "damage": "2d4"
        }
    ],
    "92": [
        {
            "type": "bite",
            "damage": "1d6"
        }
    ],
    "93": [
        {
            "type": "bite",
            "damage": "1d6"
        }
    ],
    "94": [
        {
            "type": "bite",
            "damage": "1d2"
        }
    ],
    "95": [
        {
            "type": "bite",
            "damage": "1d3",
            "effect": "poison"
        }
    ],
    "96": [
        {
            "type": "bite",
            "damage": "2d4",
            "effect": "poison"
        }
    ],
    "97": [
        {
            "type": "claw",
            "damage": "1d2"
        },
        {
            "type": "claw",
            "damage": "1d2"
        },
        {
            "type": "sting",
            "damage": "1d4",
            "effect": "poison"
        }
    ],
    "98": [
        {
            "type": "engulf",
            "damage": "1d6",
            "effect": "drown"
        },
        {
            "type": "engulf",
            "damage": "2d6"
        }
    ],
    "99": [
        {
            "type": "engulf",
            "damage": "1d8",
            "effect": "drown"
        },
        {
            "type": "engulf",
            "damage": "2d8"
        }
    ],
    "100": [
        {
            "type": "kick",
            "damage": "1d6"
        },
        {
            "type": "bite",
            "damage": "1d2"
        }
    ],
    "101": [
        {
            "type": "butt",
            "damage": "1d12"
        },
        {
            "type": "kick",
            "damage": "1d6"
        }
    ],
    "102": [
        {
            "type": "butt",
            "damage": "1d12"
        },
        {
            "type": "kick",
            "damage": "1d6"
        }
    ],
    "103": [
        {
            "type": "butt",
            "damage": "1d12"
        },
        {
            "type": "kick",
            "damage": "1d6"
        }
    ],
    "104": [
        {
            "type": "kick",
            "damage": "1d8"
        },
        {
            "type": "bite",
            "damage": "1d3"
        }
    ],
    "105": [
        {
            "type": "kick",
            "damage": "1d10"
        },
        {
            "type": "bite",
            "damage": "1d4"
        }
    ],
    "106": [
        {
            "type": "engulf",
            "damage": "1d6"
        }
    ],
    "107": [
        {
            "type": "engulf",
            "damage": "2d8",
            "effect": "blind"
        }
    ],
    "108": [
        {
            "type": "engulf",
            "damage": "1d6",
            "effect": "cold"
        }
    ],
    "109": [
        {
            "type": "engulf",
            "damage": "1d6",
            "effect": "elec"
        },
        {
            "type": "engulf",
            "damage": "2d6",
            "effect": "drain_energy"
        }
    ],
    "110": [
        {
            "type": "engulf",
            "damage": "1d8",
            "effect": "fire"
        }
    ],
    "111": [
        {
            "type": "engulf",
            "damage": "1d10",
            "effect": "fire"
        }
    ],
    "112": [
        {
            "type": "bite",
            "damage": "1d4"
        }
    ],
    "113": [
        {
            "type": "bite",
            "damage": "1d6"
        }
    ],
    "114": [
        {
            "type": "bite",
            "damage": "2d4"
        }
    ],
    "115": [
        {
            "type": "bite",
            "damage": "2d8"
        },
        {
            "type": "engulf",
            "damage": "1d10",
            "effect": "digest"
        }
    ],
    "116": [
        {
            "type": "bite",
            "damage": "1d1",
            "effect": "elec"
        }
    ],
    "117": [
        {
            "type": "sting",
            "damage": "1d4",
            "effect": "leg_wound"
        }
    ],
    "118": [
        {
            "type": "explode",
            "damage": "10d20",
            "effect": "blind"
        }
    ],
    "119": [
        {
            "type": "explode",
            "damage": "10d12",
            "effect": "hallu"
        }
    ],
    "120": [
        {
            "type": "claw",
            "damage": "3d4"
        },
        {
            "type": "claw",
            "damage": "3d4"
        },
        {
            "type": "bite",
            "damage": "3d6"
        }
    ],
    "121": [
        {
            "type": "bite",
            "damage": "2d4",
            "effect": "poison"
        },
        {
            "type": "bite",
            "damage": "1d3"
        },
        {
            "type": "hug",
            "damage": "2d4",
            "effect": "drown"
        }
    ],
    "122": [
        {
            "type": "weapon",
            "damage": "1d6"
        },
        {
            "type": "weapon",
            "damage": "1d6"
        },
        {
            "type": "kick",
            "damage": "1d4"
        }
    ],
    "123": [
        {
            "type": "weapon",
            "damage": "1d6"
        },
        {
            "type": "weapon",
            "damage": "1d6"
        },
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "cast",
            "damage": "2d6",
            "effect": "magic_missile"
        }
    ],
    "124": [
        {
            "type": "kick",
            "damage": "2d4"
        },
        {
            "type": "kick",
            "damage": "2d4"
        },
        {
            "type": "butt",
            "damage": "3d6"
        },
        {
            "type": "cast",
            "damage": "2d6",
            "effect": "magic_spell"
        }
    ],
    "125": [
        {
            "type": "weapon",
            "damage": "2d4"
        },
        {
            "type": "weapon",
            "damage": "2d4"
        },
        {
            "type": "gaze",
            "damage": "2d6",
            "effect": "blind"
        },
        {
            "type": "claw",
            "damage": "1d8"
        },
        {
            "type": "cast",
            "damage": "4d6",
            "effect": "magic_spell"
        }
    ],
    "126": [
        {
            "type": "bite",
            "damage": "1d4"
        }
    ],
    "127": [
        {
            "type": "bite",
            "damage": "1d6"
        }
    ],
    "128": [
        {
            "type": "bite",
            "damage": "1d6"
        },
        {
            "type": "claw",
            "damage": "1d6",
            "effect": "blind"
        }
    ],
    "129": [
        {
            "type": "bite",
            "damage": "1d6"
        },
        {
            "type": "bite",
            "effect": "poison"
        }
    ],
    "130": [
        {
            "type": "weapon",
            "damage": "1d6"
        },
        {
            "type": "kick",
            "damage": "1d6"
        }
    ],
    "131": [
        {
            "type": "weapon",
            "damage": "1d8"
        },
        {
            "type": "kick",
            "damage": "1d6"
        }
    ],
    "132": [
        {
            "type": "weapon",
            "damage": "1d10"
        },
        {
            "type": "kick",
            "damage": "1d6"
        },
        {
            "type": "kick",
            "damage": "1d6"
        }
    ],
    "133": [
        {
            "type": "bite",
            "damage": "2d6"
        }
    ],
    "134": [
        {
            "type": "bite",
            "damage": "2d6"
        }
    ],
    "135": [
        {
            "type": "bite",
            "damage": "2d6"
        }
    ],
    "136": [
        {
            "type": "bite",
            "damage": "2d6"
        }
    ],
    "137": [
        {
            "type": "bite",
            "damage": "2d6"
        }
    ],
    "138": [
        {
            "type": "bite",
            "damage": "2d6"
        }
    ],
    "139": [
        {
            "type": "bite",
            "damage": "2d6"
        }
    ],
    "140": [
        {
            "type": "bite",
            "damage": "2d6"
        }
    ],
    "141": [
        {
            "type": "bite",
            "damage": "2d6"
        }
    ],
    "142": [
        {
            "type": "bite",
            "damage": "2d6"
        }
    ],
    "143": [
        {
            "type": "breath",
            "damage": "4d6",
            "effect": "magic_missile"
        },
        {
            "type": "bite",
            "damage": "3d8"
        },
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "claw",
            "damage": "1d4"
        }
    ],
    "144": [
        {
            "type": "breath",
            "damage": "4d6",
            "effect": "fire"
        },
        {
            "type": "bite",
            "damage": "3d8"
        },
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "claw",
            "damage": "1d4"
        }
    ],
    "145": [
        {
            "type": "breath",
            "damage": "4d6",
            "effect": "cold"
        },
        {
            "type": "bite",
            "damage": "3d8"
        },
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "claw",
            "damage": "1d4"
        }
    ],
    "146": [
        {
            "type": "breath",
            "damage": "6d6",
            "effect": "fire"
        },
        {
            "type": "bite",
            "damage": "3d8"
        },
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "claw",
            "damage": "1d4"
        }
    ],
    "147": [
        {
            "type": "breath",
            "damage": "4d6",
            "effect": "cold"
        },
        {
            "type": "bite",
            "damage": "3d8"
        },
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "claw",
            "damage": "1d4"
        }
    ],
    "148": [
        {
            "type": "breath",
            "damage": "4d25",
            "effect": "sleep"
        },
        {
            "type": "bite",
            "damage": "3d8"
        },
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "claw",
            "damage": "1d4"
        }
    ],
    "149": [
        {
            "type": "breath",
            "damage": "1d255",
            "effect": "disintegration"
        },
        {
            "type": "bite",
            "damage": "3d8"
        },
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "claw",
            "damage": "1d4"
        }
    ],
    "150": [
        {
            "type": "breath",
            "damage": "4d6",
            "effect": "elec"
        },
        {
            "type": "bite",
            "damage": "3d8"
        },
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "claw",
            "damage": "1d4"
        }
    ],
    "151": [
        {
            "type": "breath",
            "damage": "4d6",
            "effect": "poison"
        },
        {
            "type": "bite",
            "damage": "3d8"
        },
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "claw",
            "damage": "1d4"
        }
    ],
    "152": [
        {
            "type": "breath",
            "damage": "4d6",
            "effect": "acid"
        },
        {
            "type": "bite",
            "damage": "3d8"
        },
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "claw",
            "damage": "1d4"
        }
    ],
    "153": [
        {
            "type": "claw",
            "damage": "4d4"
        }
    ],
    "154": [
        {
            "type": "engulf",
            "damage": "1d10"
        }
    ],
    "155": [
        {
            "type": "claw",
            "damage": "3d6",
            "effect": "fire"
        }
    ],
    "156": [
        {
            "type": "claw",
            "damage": "4d6"
        }
    ],
    "157": [
        {
            "type": "claw",
            "damage": "5d6"
        }
    ],
    "158": [
        {
            "type": "touch",
            "effect": "stick"
        }
    ],
    "159": [],
    "160": [],
    "161": [],
    "162": [],
    "163": [],
    "164": [
        {
            "type": "touch",
            "damage": "1d4"
        },
        {
            "type": "touch",
            "effect": "stick"
        }
    ],
    "165": [
        {
            "type": "weapon",
            "damage": "1d6"
        }
    ],
    "166": [
        {
            "type": "weapon",
            "damage": "1d8"
        }
    ],
    "167": [
        {
            "type": "cast",
            "effect": "magic_spell"
        }
    ],
    "168": [
        {
            "type": "weapon",
            "damage": "2d6"
        }
    ],
    "169": [
        {
            "type": "weapon",
            "damage": "2d10"
        }
    ],
    "170": [
        {
            "type": "weapon",
            "damage": "2d10"
        }
    ],
    "171": [
        {
            "type": "weapon",
            "damage": "2d8"
        }
    ],
    "172": [
        {
            "type": "weapon",
            "damage": "2d10"
        }
    ],
    "173": [
        {
            "type": "weapon",
            "damage": "2d12"
        }
    ],
    "174": [
        {
            "type": "weapon",
            "damage": "2d8"
        },
        {
            "type": "weapon",
            "damage": "3d6"
        }
    ],
    "175": [
        {
            "type": "weapon",
            "damage": "2d12"
        }
    ],
    "176": [
        {
            "type": "weapon",
            "damage": "2d8"
        },
        {
            "type": "cast",
            "effect": "magic_spell"
        }
    ],
    "177": [
        {
            "type": "claw",
            "damage": "3d10"
        },
        {
            "type": "claw",
            "damage": "3d10"
        },
        {
            "type": "butt",
            "damage": "2d8"
        }
    ],
    "178": [
        {
            "type": "bite",
            "damage": "2d10"
        },
        {
            "type": "bite",
            "damage": "2d10"
        },
        {
            "type": "claw",
            "damage": "2d10"
        },
        {
            "type": "claw",
            "damage": "2d10"
        }
    ],
    "179": [
        {
            "type": "weapon",
            "damage": "1d4"
        }
    ],
    "180": [
        {
            "type": "weapon",
            "damage": "1d6"
        }
    ],
    "181": [
        {
            "type": "weapon",
            "damage": "1d8"
        }
    ],
    "182": [
        {
            "type": "weapon",
            "damage": "2d6"
        }
    ],
    "183": [
        {
            "type": "touch",
            "damage": "1d10",
            "effect": "cold"
        },
        {
            "type": "cast",
            "effect": "magic_spell"
        }
    ],
    "184": [
        {
            "type": "touch",
            "damage": "3d4",
            "effect": "cold"
        },
        {
            "type": "cast",
            "effect": "magic_spell"
        }
    ],
    "185": [
        {
            "type": "touch",
            "damage": "3d6",
            "effect": "cold"
        },
        {
            "type": "cast",
            "effect": "magic_spell"
        }
    ],
    "186": [
        {
            "type": "touch",
            "damage": "5d6",
            "effect": "cold"
        },
        {
            "type": "cast",
            "effect": "magic_spell"
        }
    ],
    "187": [
        {
            "type": "claw",
            "damage": "1d4"
        }
    ],
    "188": [
        {
            "type": "claw",
            "damage": "1d6"
        }
    ],
    "189": [
        {
            "type": "claw",
            "damage": "1d6"
        }
    ],
    "190": [
        {
            "type": "claw",
            "damage": "1d6"
        }
    ],
    "191": [
        {
            "type": "claw",
            "damage": "2d4"
        }
    ],
    "192": [
        {
            "type": "claw",
            "damage": "2d4"
        },
        {
            "type": "claw",
            "damage": "2d4"
        }
    ],
    "193": [
        {
            "type": "claw",
            "damage": "2d6"
        },
        {
            "type": "claw",
            "damage": "2d6"
        }
    ],
    "194": [
        {
            "type": "claw",
            "damage": "3d4"
        },
        {
            "type": "claw",
            "damage": "3d4"
        }
    ],
    "195": [
        {
            "type": "bite",
            "damage": "1d4"
        }
    ],
    "196": [
        {
            "type": "bite",
            "damage": "1d4"
        }
    ],
    "197": [
        {
            "type": "bite",
            "damage": "1d4"
        }
    ],
    "198": [
        {
            "type": "bite",
            "damage": "1d4"
        }
    ],
    "199": [
        {
            "type": "bite",
            "damage": "2d4"
        },
        {
            "type": "breath",
            "damage": "2d6",
            "effect": "fire"
        }
    ],
    "200": [
        {
            "type": "bite",
            "damage": "2d6"
        },
        {
            "type": "spit",
            "effect": "acid"
        }
    ],
    "201": [
        {
            "type": "bite",
            "damage": "2d6"
        },
        {
            "type": "cast",
            "damage": "4d6",
            "effect": "magic_spell"
        }
    ],
    "202": [
        {
            "type": "spit",
            "damage": "1d6",
            "effect": "poison"
        },
        {
            "type": "bite",
            "damage": "1d6",
            "effect": "paralysis"
        },
        {
            "type": "touch"
        },
        {
            "type": "hug",
            "damage": "2d4",
            "effect": "drown"
        }
    ],
    "203": [
        {
            "type": "weapon",
            "damage": "2d5"
        }
    ],
    "204": [
        {
            "type": "weapon",
            "damage": "2d6"
        }
    ],
    "205": [
        {
            "type": "weapon",
            "damage": "3d5"
        }
    ],
    "206": [
        {
            "type": "bite",
            "damage": "2d8",
            "effect": "rust"
        }
    ],
    "207": [
        {
            "type": "bite",
            "effect": "rot"
        }
    ],
    "208": [
        {
            "type": "touch",
            "damage": "1d4",
            "effect": "slime"
        }
    ],
    "209": [
        {
            "type": "bite",
            "damage": "3d8",
            "effect": "rot"
        }
    ],
    "210": [
        {
            "type": "claw",
            "damage": "1d4",
            "effect": "teleport"
        }
    ],
    "211": [
        {
            "type": "claw",
            "damage": "1d4",
            "effect": "polymorph"
        }
    ],
    "212": [
        {
            "type": "touch",
            "effect": "rust"
        },
        {
            "type": "touch",
            "effect": "rust"
        }
    ],
    "213": [
        {
            "type": "claw",
            "damage": "4d4",
            "effect": "disenchant"
        }
    ],
    "214": [
        {
            "type": "bite",
            "damage": "1d2"
        }
    ],
    "215": [
        {
            "type": "bite",
            "damage": "1d6",
            "effect": "poison"
        }
    ],
    "216": [
        {
            "type": "bite",
            "damage": "1d6",
            "effect": "poison"
        }
    ],
    "217": [
        {
            "type": "bite",
            "damage": "1d4"
        },
        {
            "type": "touch"
        },
        {
            "type": "hug",
            "damage": "1d4",
            "effect": "drown"
        },
        {
            "type": "hug",
            "damage": "2d4"
        }
    ],
    "218": [
        {
            "type": "bite",
            "damage": "1d4",
            "effect": "poison"
        },
        {
            "type": "bite",
            "damage": "1d4",
            "effect": "poison"
        }
    ],
    "219": [
        {
            "type": "bite",
            "damage": "2d4",
            "effect": "poison"
        },
        {
            "type": "spit",
            "effect": "blind"
        }
    ],
    "220": [
        {
            "type": "weapon",
            "damage": "4d2"
        },
        {
            "type": "claw",
            "damage": "4d2"
        },
        {
            "type": "bite",
            "damage": "2d6"
        }
    ],
    "221": [
        {
            "type": "weapon",
            "damage": "2d6"
        },
        {
            "type": "claw",
            "damage": "2d6",
            "effect": "cold"
        },
        {
            "type": "bite",
            "damage": "2d6"
        }
    ],
    "222": [
        {
            "type": "weapon",
            "damage": "3d6"
        },
        {
            "type": "claw",
            "damage": "2d8"
        },
        {
            "type": "bite",
            "damage": "2d6"
        }
    ],
    "223": [
        {
            "type": "weapon",
            "damage": "2d8"
        },
        {
            "type": "claw",
            "damage": "2d8"
        },
        {
            "type": "bite",
            "damage": "2d6"
        }
    ],
    "224": [
        {
            "type": "weapon",
            "damage": "3d6"
        },
        {
            "type": "claw",
            "damage": "2d8"
        },
        {
            "type": "bite",
            "damage": "2d6"
        }
    ],
    "225": [
        {
            "type": "claw",
            "damage": "3d4"
        },
        {
            "type": "claw",
            "damage": "3d4"
        },
        {
            "type": "bite",
            "damage": "2d5"
        },
        {
            "type": "gaze",
            "effect": "confuse"
        }
    ],
    "226": [
        {
            "type": "claw",
            "damage": "1d6"
        },
        {
            "type": "bite",
            "damage": "1d6",
            "effect": "drain_level"
        }
    ],
    "227": [
        {
            "type": "claw",
            "damage": "1d8"
        },
        {
            "type": "bite",
            "damage": "1d8",
            "effect": "drain_level"
        }
    ],
    "228": [
        {
            "type": "weapon",
            "damage": "2d10"
        },
        {
            "type": "bite",
            "damage": "1d12",
            "effect": "drain_level"
        }
    ],
    "229": [
        {
            "type": "weapon",
            "effect": "drain_level"
        },
        {
            "type": "cast",
            "effect": "magic_spell"
        },
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "touch",
            "damage": "1d4",
            "effect": "cold"
        }
    ],
    "230": [
        {
            "type": "touch",
            "damage": "1d6",
            "effect": "drain_level"
        }
    ],
    "231": [
        {
            "type": "weapon",
            "damage": "1d4",
            "effect": "drain_level"
        },
        {
            "type": "breath",
            "damage": "2d25",
            "effect": "sleep"
        }
    ],
    "232": [
        {
            "type": "claw",
            "damage": "1d3"
        },
        {
            "type": "claw",
            "damage": "1d3"
        },
        {
            "type": "claw",
            "damage": "1d3"
        },
        {
            "type": "bite",
            "damage": "4d6"
        }
    ],
    "233": [
        {
            "type": "claw",
            "effect": "steal_item"
        },
        {
            "type": "bite",
            "damage": "1d3"
        }
    ],
    "234": [
        {
            "type": "claw",
            "damage": "1d3"
        },
        {
            "type": "claw",
            "damage": "1d3"
        },
        {
            "type": "bite",
            "damage": "1d6"
        }
    ],
    "235": [
        {
            "type": "claw",
            "damage": "1d6"
        },
        {
            "type": "claw",
            "damage": "1d6"
        },
        {
            "type": "hug",
            "damage": "2d8"
        }
    ],
    "236": [
        {
            "type": "claw",
            "damage": "1d6"
        },
        {
            "type": "claw",
            "damage": "1d6"
        },
        {
            "type": "bite",
            "damage": "1d4"
        }
    ],
    "237": [
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "hug",
            "damage": "1d8"
        }
    ],
    "238": [
        {
            "type": "claw",
            "damage": "1d6"
        },
        {
            "type": "claw",
            "damage": "1d6"
        },
        {
            "type": "kick",
            "damage": "1d8"
        }
    ],
    "239": [
        {
            "type": "claw",
            "damage": "1d4"
        }
    ],
    "240": [
        {
            "type": "claw",
            "damage": "1d5"
        }
    ],
    "241": [
        {
            "type": "claw",
            "damage": "1d6"
        }
    ],
    "242": [
        {
            "type": "claw",
            "damage": "1d6"
        }
    ],
    "243": [
        {
            "type": "claw",
            "damage": "1d7"
        }
    ],
    "244": [
        {
            "type": "claw",
            "damage": "1d8"
        }
    ],
    "245": [
        {
            "type": "claw",
            "damage": "1d10"
        },
        {
            "type": "claw",
            "damage": "1d10"
        }
    ],
    "246": [
        {
            "type": "claw",
            "damage": "1d2",
            "effect": "paralysis"
        },
        {
            "type": "claw",
            "damage": "1d3"
        }
    ],
    "247": [
        {
            "type": "claw",
            "damage": "2d8"
        },
        {
            "type": "claw",
            "damage": "2d8"
        }
    ],
    "248": [
        {
            "type": "weapon",
            "damage": "2d6"
        },
        {
            "type": "touch",
            "damage": "1d6",
            "effect": "slow"
        }
    ],
    "249": [
        {
            "type": "claw",
            "damage": "1d2"
        },
        {
            "type": "claw",
            "damage": "1d2"
        }
    ],
    "250": [
        {
            "type": "claw",
            "damage": "1d3"
        }
    ],
    "251": [
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "hug",
            "damage": "6d1"
        }
    ],
    "252": [
        {
            "type": "claw",
            "damage": "2d3"
        },
        {
            "type": "claw",
            "damage": "2d3"
        }
    ],
    "253": [
        {
            "type": "claw",
            "damage": "1d6"
        },
        {
            "type": "claw",
            "damage": "1d6"
        }
    ],
    "254": [
        {
            "type": "claw",
            "damage": "3d4"
        }
    ],
    "255": [
        {
            "type": "claw",
            "damage": "2d8"
        },
        {
            "type": "claw",
            "damage": "2d8"
        }
    ],
    "256": [
        {
            "type": "claw",
            "damage": "3d10"
        }
    ],
    "257": [
        {
            "type": "claw",
            "damage": "3d8"
        }
    ],
    "258": [
        {
            "type": "claw",
            "damage": "2d8"
        },
        {
            "type": "claw",
            "damage": "2d8"
        }
    ],
    "259": [
        {
            "type": "weapon",
            "damage": "4d10"
        },
        {
            "type": "breath",
            "damage": "4d6",
            "effect": "poison"
        }
    ],
    "260": [
        {
            "type": "weapon",
            "damage": "1d6"
        }
    ],
    "261": [
        {
            "type": "weapon",
            "damage": "2d4"
        }
    ],
    "262": [
        {
            "type": "weapon",
            "damage": "2d4"
        }
    ],
    "263": [
        {
            "type": "weapon",
            "damage": "2d4"
        }
    ],
    "264": [
        {
            "type": "weapon",
            "damage": "1d8"
        }
    ],
    "265": [
        {
            "type": "weapon",
            "damage": "2d4"
        }
    ],
    "266": [
        {
            "type": "weapon",
            "damage": "2d4"
        }
    ],
    "267": [
        {
            "type": "weapon",
            "damage": "2d4"
        }
    ],
    "268": [
        {
            "type": "weapon",
            "damage": "2d4"
        },
        {
            "type": "weapon",
            "damage": "2d4"
        }
    ],
    "269": [
        {
            "type": "weapon",
            "damage": "2d4"
        },
        {
            "type": "weapon",
            "damage": "2d4"
        }
    ],
    "270": [
        {
            "type": "weapon",
            "damage": "1d12"
        }
    ],
    "271": [
        {
            "type": "weapon",
            "damage": "4d4"
        },
        {
            "type": "weapon",
            "damage": "4d4"
        }
    ],
    "272": [
        {
            "type": "weapon",
            "damage": "4d10"
        }
    ],
    "273": [
        {
            "type": "weapon",
            "damage": "1d6"
        }
    ],
    "274": [],
    "275": [
        {
            "type": "weapon",
            "damage": "4d10"
        },
        {
            "type": "kick",
            "damage": "1d4"
        },
        {
            "type": "cast",
            "effect": "clerical_spell"
        }
    ],
    "276": [
        {
            "type": "weapon",
            "damage": "4d10"
        },
        {
            "type": "kick",
            "damage": "2d8"
        },
        {
            "type": "cast",
            "damage": "2d8",
            "effect": "clerical_spell"
        },
        {
            "type": "cast",
            "damage": "2d8",
            "effect": "clerical_spell"
        }
    ],
    "277": [
        {
            "type": "weapon",
            "damage": "1d8"
        }
    ],
    "278": [
        {
            "type": "weapon",
            "damage": "2d6"
        }
    ],
    "279": [
        {
            "type": "claw",
            "damage": "2d6",
            "effect": "heal"
        }
    ],
    "280": [
        {
            "type": "weapon",
            "damage": "3d4"
        },
        {
            "type": "weapon",
            "damage": "3d4"
        }
    ],
    "281": [
        {
            "type": "weapon",
            "damage": "4d4"
        },
        {
            "type": "weapon",
            "damage": "4d4"
        }
    ],
    "282": [
        {
            "type": "weapon",
            "damage": "1d8"
        }
    ],
    "283": [
        {
            "type": "weapon",
            "damage": "3d4"
        },
        {
            "type": "weapon",
            "damage": "3d4"
        }
    ],
    "284": [
        {
            "type": "weapon",
            "damage": "2d4"
        },
        {
            "type": "claw",
            "damage": "1d8"
        },
        {
            "type": "gaze",
            "effect": "stoning"
        },
        {
            "type": "bite",
            "damage": "1d6",
            "effect": "poison"
        }
    ],
    "285": [
        {
            "type": "claw",
            "damage": "2d12",
            "effect": "steal_amulet"
        },
        {
            "type": "cast",
            "effect": "magic_spell"
        }
    ],
    "286": [
        {
            "type": "weapon",
            "damage": "4d10"
        }
    ],
    "287": [
        {
            "type": "touch",
            "damage": "1d1"
        }
    ],
    "288": [
        {
            "type": "touch",
            "damage": "2d6",
            "effect": "paralysis"
        },
        {
            "type": "touch",
            "damage": "1d6",
            "effect": "slow"
        }
    ],
    "289": [
        {
            "type": "weapon",
            "damage": "1d3"
        },
        {
            "type": "claw",
            "damage": "1d3"
        },
        {
            "type": "bite",
            "damage": "1d3"
        }
    ],
    "290": [
        {
            "type": "claw",
            "effect": "seduce"
        },
        {
            "type": "claw",
            "damage": "1d3"
        },
        {
            "type": "bite",
            "damage": "2d6",
            "effect": "drain_level"
        }
    ],
    "291": [
        {
            "type": "weapon",
            "damage": "1d4"
        },
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "bite",
            "damage": "2d3"
        },
        {
            "type": "sting",
            "damage": "1d3"
        }
    ],
    "292": [
        {
            "type": "weapon",
            "damage": "2d4",
            "effect": "poison"
        }
    ],
    "293": [
        {
            "type": "claw",
            "damage": "2d4"
        },
        {
            "type": "claw",
            "damage": "2d4",
            "effect": "stick"
        },
        {
            "type": "sting",
            "damage": "3d4"
        }
    ],
    "294": [
        {
            "type": "weapon",
            "damage": "2d4"
        },
        {
            "type": "weapon",
            "damage": "2d4"
        },
        {
            "type": "claw",
            "damage": "2d4"
        },
        {
            "type": "claw",
            "damage": "2d4"
        },
        {
            "type": "claw",
            "damage": "2d4"
        },
        {
            "type": "claw",
            "damage": "2d4"
        }
    ],
    "295": [
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "claw",
            "damage": "1d8"
        },
        {
            "type": "claw",
            "damage": "1d8"
        },
        {
            "type": "bite",
            "damage": "1d6"
        }
    ],
    "296": [
        {
            "type": "claw",
            "damage": "1d3"
        },
        {
            "type": "claw",
            "damage": "1d3"
        },
        {
            "type": "bite",
            "damage": "4d4"
        }
    ],
    "297": [
        {
            "type": "weapon",
            "damage": "3d4"
        },
        {
            "type": "sting",
            "damage": "2d4",
            "effect": "poison"
        }
    ],
    "298": [
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "bite",
            "damage": "2d4"
        },
        {
            "type": "sting",
            "damage": "3d4",
            "effect": "cold"
        },
        {
            "type": "touch",
            "damage": "1d1",
            "effect": "slow"
        }
    ],
    "299": [
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "claw",
            "damage": "1d4"
        },
        {
            "type": "bite",
            "damage": "2d4"
        },
        {
            "type": "cast",
            "effect": "magic_spell"
        }
    ],
    "300": [
        {
            "type": "weapon",
            "damage": "4d2"
        },
        {
            "type": "weapon",
            "damage": "4d2"
        },
        {
            "type": "hug",
            "damage": "2d4"
        }
    ],
    "301": [
        {
            "type": "weapon",
            "damage": "2d6"
        },
        {
            "type": "weapon",
            "damage": "2d6"
        }
    ],
    "302": [
        {
            "type": "weapon",
            "damage": "8d4"
        },
        {
            "type": "weapon",
            "damage": "4d6"
        }
    ],
    "303": [
        {
            "type": "engulf",
            "damage": "4d10",
            "effect": "disease"
        },
        {
            "type": "spit",
            "damage": "3d6",
            "effect": "acid"
        }
    ],
    "304": [
        {
            "type": "weapon",
            "damage": "3d6"
        },
        {
            "type": "weapon",
            "damage": "2d8",
            "effect": "confuse"
        },
        {
            "type": "claw",
            "damage": "1d6",
            "effect": "paralysis"
        },
        {
            "type": "cast",
            "damage": "2d6",
            "effect": "magic_missile"
        }
    ],
    "305": [
        {
            "type": "weapon",
            "damage": "3d6"
        },
        {
            "type": "claw",
            "damage": "3d4"
        },
        {
            "type": "claw",
            "damage": "3d4"
        },
        {
            "type": "cast",
            "damage": "8d6",
            "effect": "magic_spell"
        },
        {
            "type": "sting",
            "damage": "2d4",
            "effect": "poison"
        }
    ],
    "306": [
        {
            "type": "claw",
            "damage": "3d6"
        },
        {
            "type": "claw",
            "damage": "3d6"
        },
        {
            "type": "sting",
            "damage": "2d4",
            "effect": "poison"
        }
    ],
    "307": [
        {
            "type": "weapon",
            "damage": "4d6"
        },
        {
            "type": "cast",
            "damage": "6d6",
            "effect": "magic_spell"
        }
    ],
    "308": [
        {
            "type": "bite",
            "damage": "2d6",
            "effect": "poison"
        },
        {
            "type": "gaze",
            "damage": "2d6",
            "effect": "stun"
        }
    ],
    "309": [
        {
            "type": "claw",
            "damage": "4d4"
        },
        {
            "type": "cast",
            "damage": "6d6",
            "effect": "cold"
        }
    ],
    "310": [
        {
            "type": "cast",
            "damage": "8d6",
            "effect": "magic_spell"
        },
        {
            "type": "sting",
            "damage": "1d4",
            "effect": "drain_level"
        },
        {
            "type": "claw",
            "damage": "1d6",
            "effect": "disease"
        },
        {
            "type": "claw",
            "damage": "1d6",
            "effect": "disease"
        }
    ],
    "311": [
        {
            "type": "touch",
            "damage": "8d8",
            "effect": "death"
        },
        {
            "type": "touch",
            "damage": "8d8",
            "effect": "death"
        }
    ],
    "312": [
        {
            "type": "touch",
            "damage": "8d8",
            "effect": "pestilence"
        },
        {
            "type": "touch",
            "damage": "8d8",
            "effect": "pestilence"
        }
    ],
    "313": [
        {
            "type": "touch",
            "damage": "8d8",
            "effect": "famine"
        },
        {
            "type": "touch",
            "damage": "8d8",
            "effect": "famine"
        }
    ],
    "314": [],
    "315": [
        {
            "type": "weapon",
            "damage": "2d8"
        }
    ],
    "316": [
        {
            "type": "sting",
            "damage": "3d3",
            "effect": "poison"
        }
    ],
    "317": [
        {
            "type": "bite",
            "damage": "2d6"
        },
        {
            "type": "bite",
            "damage": "2d6"
        }
    ],
    "318": [
        {
            "type": "bite",
            "damage": "5d6"
        }
    ],
    "319": [
        {
            "type": "bite",
            "damage": "3d6"
        },
        {
            "type": "touch",
            "effect": "drown"
        }
    ],
    "320": [
        {
            "type": "bite",
            "damage": "4d6",
            "effect": "elec"
        },
        {
            "type": "touch",
            "effect": "drown"
        }
    ],
    "321": [
        {
            "type": "claw",
            "damage": "2d4"
        },
        {
            "type": "claw",
            "damage": "2d4"
        },
        {
            "type": "hug",
            "damage": "2d6",
            "effect": "drown"
        },
        {
            "type": "bite",
            "damage": "5d4"
        }
    ],
    "322": [
        {
            "type": "bite",
            "damage": "1d2"
        }
    ],
    "323": [
        {
            "type": "bite",
            "damage": "1d3"
        }
    ],
    "324": [
        {
            "type": "bite",
            "damage": "1d4"
        }
    ],
    "325": [
        {
            "type": "bite",
            "damage": "1d4"
        }
    ],
    "326": [
        {
            "type": "bite",
            "damage": "1d6"
        }
    ],
    "327": [
        {
            "type": "bite",
            "damage": "4d2"
        }
    ],
    "328": [
        {
            "type": "bite",
            "damage": "4d2"
        },
        {
            "type": "claw",
            "damage": "1d12"
        }
    ],
    "329": [
        {
            "type": "weapon",
            "damage": "2d8"
        },
        {
            "type": "touch",
            "damage": "1d6",
            "effect": "fire"
        },
        {
            "type": "hug",
            "damage": "2d6"
        },
        {
            "type": "hug",
            "damage": "3d6",
            "effect": "fire"
        }
    ],
    "330": [],
    "331": [
        {
            "type": "weapon",
            "damage": "1d6"
        },
        {
            "type": "weapon",
            "damage": "1d6"
        }
    ],
    "332": [
        {
            "type": "weapon",
            "damage": "1d6"
        },
        {
            "type": "weapon",
            "damage": "1d6"
        }
    ],
    "333": [
        {
            "type": "weapon",
            "damage": "2d4"
        }
    ],
    "334": [
        {
            "type": "weapon",
            "damage": "1d6"
        }
    ],
    "335": [
        {
            "type": "weapon",
            "damage": "1d6"
        },
        {
            "type": "weapon",
            "damage": "1d6"
        }
    ],
    "336": [
        {
            "type": "claw",
            "damage": "1d8"
        },
        {
            "type": "kick",
            "damage": "1d8"
        }
    ],
    "337": [
        {
            "type": "weapon",
            "damage": "1d6"
        },
        {
            "type": "cast",
            "effect": "clerical_spell"
        }
    ],
    "338": [
        {
            "type": "weapon",
            "damage": "1d4"
        }
    ],
    "339": [
        {
            "type": "weapon",
            "damage": "1d6"
        },
        {
            "type": "weapon",
            "damage": "1d6"
        }
    ],
    "340": [
        {
            "type": "weapon",
            "damage": "1d8"
        },
        {
            "type": "weapon",
            "damage": "1d8"
        }
    ],
    "341": [
        {
            "type": "weapon",
            "damage": "1d6"
        },
        {
            "type": "weapon",
            "damage": "1d6"
        }
    ],
    "342": [
        {
            "type": "weapon",
            "damage": "1d8"
        },
        {
            "type": "weapon",
            "damage": "1d8"
        }
    ],
    "343": [
        {
            "type": "weapon",
            "damage": "1d6"
        },
        {
            "type": "cast",
            "effect": "magic_spell"
        }
    ],
    "344": [
        {
            "type": "weapon",
            "damage": "4d10"
        },
        {
            "type": "cast",
            "damage": "4d8",
            "effect": "magic_spell"
        }
    ],
    "345": [
        {
            "type": "weapon",
            "damage": "4d10"
        },
        {
            "type": "weapon",
            "damage": "4d10"
        }
    ],
    "346": [
        {
            "type": "weapon",
            "damage": "4d10"
        },
        {
            "type": "cast",
            "damage": "2d8",
            "effect": "clerical_spell"
        }
    ],
    "347": [
        {
            "type": "weapon",
            "damage": "1d6"
        },
        {
            "type": "cast",
            "damage": "3d8",
            "effect": "clerical_spell"
        },
        {
            "type": "cast",
            "damage": "3d8",
            "effect": "clerical_spell"
        }
    ],
    "348": [
        {
            "type": "weapon",
            "damage": "4d10"
        },
        {
            "type": "weapon",
            "damage": "4d10"
        }
    ],
    "349": [
        {
            "type": "claw",
            "damage": "4d10"
        },
        {
            "type": "kick",
            "damage": "2d8"
        },
        {
            "type": "cast",
            "damage": "2d8",
            "effect": "clerical_spell"
        },
        {
            "type": "cast",
            "damage": "2d8",
            "effect": "clerical_spell"
        }
    ],
    "350": [
        {
            "type": "weapon",
            "damage": "4d10"
        },
        {
            "type": "kick",
            "damage": "2d8"
        },
        {
            "type": "cast",
            "damage": "2d8",
            "effect": "clerical_spell"
        },
        {
            "type": "cast",
            "damage": "2d8",
            "effect": "clerical_spell"
        }
    ],
    "351": [
        {
            "type": "weapon",
            "damage": "4d10"
        },
        {
            "type": "cast",
            "damage": "4d8",
            "effect": "magic_spell"
        }
    ],
    "352": [
        {
            "type": "weapon",
            "damage": "4d10"
        },
        {
            "type": "weapon",
            "damage": "2d6"
        },
        {
            "type": "claw",
            "damage": "2d4",
            "effect": "steal_amulet"
        }
    ],
    "353": [
        {
            "type": "weapon",
            "damage": "4d10"
        },
        {
            "type": "weapon",
            "damage": "4d10"
        }
    ],
    "354": [
        {
            "type": "weapon",
            "damage": "4d10"
        }
    ],
    "355": [
        {
            "type": "weapon",
            "damage": "4d10"
        },
        {
            "type": "weapon",
            "damage": "4d10"
        }
    ],
    "356": [
        {
            "type": "weapon",
            "damage": "4d10"
        },
        {
            "type": "cast",
            "damage": "2d8",
            "effect": "magic_spell"
        },
        {
            "type": "cast",
            "damage": "2d8",
            "effect": "magic_spell"
        }
    ],
    "357": [
        {
            "type": "weapon",
            "damage": "8d4"
        },
        {
            "type": "weapon",
            "damage": "4d6"
        },
        {
            "type": "cast",
            "effect": "magic_spell"
        },
        {
            "type": "claw",
            "damage": "2d6",
            "effect": "steal_amulet"
        }
    ],
    "358": [
        {
            "type": "weapon",
            "damage": "1d6"
        },
        {
            "type": "cast",
            "effect": "magic_spell"
        },
        {
            "type": "cast",
            "effect": "magic_spell"
        },
        {
            "type": "claw",
            "damage": "1d4",
            "effect": "steal_amulet"
        }
    ],
    "359": [
        {
            "type": "breath",
            "damage": "6d6",
            "effect": "random_breath"
        },
        {
            "type": "cast",
            "effect": "magic_spell"
        },
        {
            "type": "claw",
            "damage": "2d8",
            "effect": "steal_amulet"
        },
        {
            "type": "bite",
            "damage": "4d8"
        },
        {
            "type": "bite",
            "damage": "4d8"
        },
        {
            "type": "sting",
            "damage": "1d6"
        }
    ],
    "360": [
        {
            "type": "weapon",
            "damage": "4d8"
        },
        {
            "type": "weapon",
            "damage": "4d8"
        },
        {
            "type": "claw",
            "damage": "2d6",
            "effect": "steal_amulet"
        }
    ],
    "361": [
        {
            "type": "breath",
            "damage": "8d6",
            "effect": "fire"
        },
        {
            "type": "bite",
            "damage": "4d8"
        },
        {
            "type": "cast",
            "effect": "magic_spell"
        },
        {
            "type": "claw",
            "damage": "2d4"
        },
        {
            "type": "claw",
            "damage": "2d4",
            "effect": "steal_amulet"
        }
    ],
    "362": [
        {
            "type": "claw",
            "damage": "16d2"
        },
        {
            "type": "claw",
            "damage": "16d2"
        },
        {
            "type": "cast",
            "effect": "clerical_spell"
        },
        {
            "type": "claw",
            "damage": "1d4",
            "effect": "steal_amulet"
        }
    ],
    "363": [
        {
            "type": "weapon",
            "damage": "8d4"
        },
        {
            "type": "weapon",
            "damage": "4d6"
        },
        {
            "type": "cast",
            "effect": "magic_spell"
        },
        {
            "type": "claw",
            "damage": "2d6",
            "effect": "steal_amulet"
        }
    ],
    "364": [
        {
            "type": "claw",
            "damage": "2d6"
        },
        {
            "type": "claw",
            "damage": "2d6",
            "effect": "steal_amulet"
        },
        {
            "type": "sting",
            "damage": "1d4",
            "effect": "disease"
        }
    ],
    "365": [
        {
            "type": "weapon",
            "damage": "2d6",
            "effect": "poison"
        },
        {
            "type": "weapon",
            "damage": "2d8"
        },
        {
            "type": "claw",
            "damage": "2d6",
            "effect": "steal_amulet"
        }
    ],
    "366": [
        {
            "type": "weapon",
            "damage": "2d6"
        },
        {
            "type": "weapon",
            "damage": "2d6"
        },
        {
            "type": "claw",
            "damage": "2d6",
            "effect": "steal_amulet"
        }
    ],
    "367": [
        {
            "type": "weapon",
            "damage": "2d10"
        },
        {
            "type": "weapon",
            "damage": "2d10"
        },
        {
            "type": "claw",
            "damage": "2d6",
            "effect": "steal_amulet"
        }
    ],
    "368": [
        {
            "type": "weapon",
            "damage": "1d6"
        },
        {
            "type": "weapon",
            "damage": "1d6"
        },
        {
            "type": "claw",
            "damage": "1d4",
            "effect": "steal_amulet"
        },
        {
            "type": "cast",
            "effect": "magic_spell"
        }
    ],
    "369": [
        {
            "type": "weapon",
            "damage": "1d6"
        }
    ],
    "370": [
        {
            "type": "weapon",
            "damage": "1d6"
        }
    ],
    "371": [
        {
            "type": "weapon",
            "damage": "2d4"
        }
    ],
    "372": [
        {
            "type": "weapon",
            "damage": "1d6"
        }
    ],
    "373": [
        {
            "type": "weapon",
            "damage": "1d6"
        },
        {
            "type": "weapon",
            "damage": "1d6"
        }
    ],
    "374": [
        {
            "type": "claw",
            "damage": "8d2"
        },
        {
            "type": "kick",
            "damage": "3d2",
            "effect": "stun"
        },
        {
            "type": "cast",
            "effect": "clerical_spell"
        }
    ],
    "375": [
        {
            "type": "weapon",
            "damage": "1d6"
        },
        {
            "type": "cast",
            "effect": "clerical_spell"
        }
    ],
    "376": [
        {
            "type": "weapon",
            "damage": "1d4"
        }
    ],
    "377": [
        {
            "type": "weapon",
            "damage": "1d6"
        },
        {
            "type": "weapon",
            "damage": "1d6"
        }
    ],
    "378": [
        {
            "type": "weapon",
            "damage": "1d8"
        },
        {
            "type": "weapon",
            "damage": "1d8"
        }
    ],
    "379": [
        {
            "type": "weapon",
            "damage": "1d8"
        },
        {
            "type": "weapon",
            "damage": "1d8"
        }
    ],
    "380": [
        {
            "type": "weapon",
            "damage": "1d6"
        },
        {
            "type": "cast",
            "effect": "magic_spell"
        }
    ],
    "381": [
        {
            "type": "weapon",
            "damage": "1d8"
        },
        {
            "type": "weapon",
            "damage": "1d8"
        }
    ],
    "382": [
        {
            "type": "weapon",
            "damage": "1d6"
        },
        {
            "type": "cast",
            "effect": "magic_spell"
        }
    ]
};
