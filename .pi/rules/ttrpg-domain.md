# 🐉 TTRPG Domain Knowledge

> Что нужно знать о настольных RPG при разработке платформы.

---

## 1. D20 SYSTEM (D&D 5E — ОСНОВНАЯ)

### Базовые механики
```
d20 + modifiers  vs  Difficulty Class (DC)
─────────────────     ──────────────────
Атака:     d20 + prof + abilityMod  vs  AC (Armor Class)
Спасбросок: d20 + prof + abilityMod  vs  DC (spell/effect)
Проверка:  d20 + prof + abilityMod  vs  DC (skill check)
```

### Ability Scores → Modifiers
```
Score:  1  2-3  4-5  6-7  8-9  10-11  12-13  14-15  16-17  18-19  20-21 ...
Mod:   -5   -4   -3   -2   -1    0      +1     +2     +3     +4     +5
Formula: Math.floor((score - 10) / 2)
```

### Proficiency Bonus (by level)
```
Level:  1-4    5-8    9-12   13-16   17-20
Prof:   +2     +3     +4     +5      +6
```

### Шесть основных атрибутов:
| Атрибут | Влияет на | Ключевые навыки |
|---------|-----------|----------------|
| STR | Melee attack/damage, carrying | Athletics |
| DEX | AC, ranged/finesse, initiative | Stealth, Acrobatics, Sleight of Hand |
| CON | HP per level, concentration | — |
| INT | Spellcasting (Wizard) | Arcana, History, Investigation, Nature, Religion |
| WIS | Spellcasting (Cleric/Druid), perception | Perception, Insight, Medicine, Survival, Animal Handling |
| CHA | Spellcasting (Bard/Sorc/Warlock/Paladin), social | Persuasion, Deception, Intimidation, Performance |

---

## 2. ADVANTAGE / DISADVANTAGE

```typescript
function rollWithAdvantage(modifier: number): RollResult {
  const roll1 = Math.floor(Math.random() * 20) + 1;
  const roll2 = Math.floor(Math.random() * 20) + 1;
  const roll = advantage ? Math.max(roll1, roll2) : Math.min(roll1, roll2);
  return { roll, total: roll + modifier, dice: [roll1, roll2] };
}
```

**Стекирование**: Advantage и Disadvantage не стакаются. Один disadvantage отменяет ВСЕ advantages, и наоборот.

---

## 3. DAMAGE TYPES

```
Физические:  bludgeoning, piercing, slashing
Элементальные: fire, cold, lightning, thunder, acid, poison
Мистические:  force, necrotic, radiant, psychic
```

### Resistances и Vulnerabilities:
- Resistance = half damage
- Vulnerability = double damage
- Immunity = 0 damage
- Порядок: immunity → vulnerability → resistance (не стакается)

---

## 4. ACTION ECONOMY

| Действие | Описание |
|----------|----------|
| **Action** | Attack, Cast a Spell, Dash, Disengage, Dodge, Help, Hide, Ready, Search, Use Object |
| **Bonus Action** | Off-hand attack, Cunning Action (Rogue), Quickened Spell |
| **Reaction** | Opportunity Attack, Shield spell, Counterspell, Absorb Elements |
| **Movement** | Walk, climb, swim, fly, crawl, jump (uses speed) |
| **Free Action** | Talk, drop item, interact with object |

### Multiattack (монстры):
```typescript
// Goblin Boss: Multiattack (2 scimitar attacks), bonus action disengage
interface Multiattack {
  attacks: AttackReference[];  // [{ weapon: "Scimitar" }, { weapon: "Scimitar" }]
  asBonusAction?: AttackReference[];
}
```

---

## 5. CONDITIONS (СОСТОЯНИЯ)

| Condition | Эффект |
|-----------|--------|
| Blinded | Auto-fail sight checks, attacks vs have advantage, own attacks have disadvantage |
| Charmed | Can't attack charmer, charmer has advantage on social |
| Deafened | Auto-fail hearing checks |
| Frightened | Disadvantage on checks/attacks while source in sight, can't move closer |
| Grappled | Speed = 0, ends if grappler incapacitated |
| Incapacitated | Can't take actions or reactions |
| Invisible | Advantage on attacks, attacks vs have disadvantage |
| Paralyzed | Incapacitated + auto-fail STR/DEX saves + attacks within 5ft are crits |
| Petrified | As paralyzed + resistance to all damage + immune to poison/disease |
| Poisoned | Disadvantage on attacks and checks |
| Prone | Disadvantage on attacks, attacks within 5ft have advantage, ranged = disadvantage |
| Restrained | Speed = 0, disadvantage on attacks and DEX saves, attacks vs have advantage |
| Stunned | Incapacitated + auto-fail STR/DEX saves + attacks vs have advantage |
| Unconscious | Incapacitated + auto-fail STR/DEX saves + attacks vs have advantage + crits within 5ft |

---

## 6. HP, TEMP HP, DEATH SAVES

### Hit Points
```
HP = hit dice + CON mod per level (max at level 1)
Temp HP: don't stack, use highest. Lost first.
```

### Death Saves
```
When HP = 0:
- Roll d20 at start of turn
- 10+ = success, <10 = failure
- 1 = two failures, 20 = regain 1 HP
- 3 successes = stable (unconscious, 0 HP, 1d4 hours to wake)
- 3 failures = dead
- Taking damage = 1 failure (crit = 2 failures)
```

---

## 7. REST MECHANICS

### Short Rest (1 hour)
- Spend Hit Dice (dX + CON mod), regain that much HP
- Some class features recharge (Fighter: Action Surge, Warlock: spell slots)

### Long Rest (8 hours, max 1 per 24h)
- Full HP restore
- Regain half of max Hit Dice (min 1)
- All spell slots restored
- Some races need less (Elf: 4h trance)

---

## 8. SPELLCASTING

### Spell Slots (Wizard example)
```
Level:  1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18  19  20
1st:    2   3   4   4   4   4   4   4   4   4   4   4   4   4   4   4   4   4   4   4
2nd:    -   -   2   3   3   3   3   3   3   3   3   3   3   3   3   3   3   3   3   3
3rd:    -   -   -   -   2   3   3   3   3   3   3   3   3   3   3   3   3   3   3   3
...
Spell save DC = 8 + prof + spellcastingAbilityMod
Spell attack = d20 + prof + spellcastingAbilityMod
```

### Концентрация
- Одно заклинание концентрации одновременно
- CON save (DC 10 или half damage) при получении урона
- Прерывается при incapacitated или смерти

---

## 9. FOG OF WAR / VISION

### Типы зрения:
| Тип | Описание |
|-----|----------|
| Normal | Видит на указанную дистанцию |
| Darkvision | Greyscale в темноте (обычно 60ft) |
| Truesight | Видит сквозь иллюзии, невидимость, shapechangers, в темноте |
| Blindsight | «Видит» без зрения (эхолокация, вибрации) — обычно 10-60ft |
| Tremorsense | Чувствует вибрации в земле |

### Fog of War модель Vibe:
```
По умолчанию: ВСЁ в тумане (fogMap пуст = полный туман)
Reveal: добавляет дыру в тумане (круг/прямоугольник)
Cover: удаляет просветы в области (скрывает обратно)
ГМ видит туман опционально (gmFogVisible toggle)
Игроки видят туман всегда (playerFogVisible=true)
```

---

## 10. СУЩЕСТВА И СТАТБЛОКИ

### Минимальный статблок NPC:
```yaml
name: Goblin
type: character
properties:
  hp: { max: 7, current: 7 }
  ac: 15
  speed: 30
  str: 8
  dex: 14
  con: 10
  int: 10
  wis: 8
  cha: 8
  challenge: 0.25
  xp: 50
```

### CR (Challenge Rating):
```
CR:     0    1/8  1/4  1/2   1    2    3    4    5    ...
XP:    10    25   50  100  200  450  700 1100 1800  ...
Prof:  +2    +2   +2   +2   +2   +2   +2   +2   +3   ...
```

---

## 11. ИНИЦИАТИВА И БОЙ

```
Initiative = d20 + DEX mod
Порядок: по убыванию. Ничьи — PC > NPC, между PC — их выбор.
```

### Surprise:
- Если одна сторона скрыта: contest Stealth vs Passive Perception
- Удивлённая сторона пропускает первый ход (не может действовать)

### Cover:
| Type | AC Bonus | DEX Save Bonus |
|------|----------|---------------|
| Half cover | +2 | +2 |
| Three-quarters | +5 | +5 |
| Full cover | Нельзя атаковать | Нельзя атаковать |

---

## 12. ИНВЕНТАРЬ И ЭКИПИРОВКА

### Слоты экипировки:
```
Main Hand, Off Hand (или Two-Handed)
Armor
Head, Neck, Ring1, Ring2
Cloak, Belt, Boots, Gloves
```

### Вес и encumbrance (variant):
```
Carrying capacity = STR × 15 lbs
Encumbered (> STR × 5): speed -10
Heavily Encumbered (> STR × 10): speed -20, disadvantage on checks
```

---

## 13. РАЗНОЕ

### Proficiency и Expertise:
- Proficiency: +prof к проверке
- Expertise: +2×prof к проверке

### Critical Hits:
- Nat 20 = auto-hit + двойной дайс урона
- Nat 1 = auto-miss
- Some features expand crit range (Champion Fighter: 19-20)

### Cover и препятсвия:
- Половина укрытия: +2 AC
- Три четверти: +5 AC
- Полное укрытие: нельзя атаковать

### Difficult Terrain:
- Каждый фут движения стоит 2 фута скорости

---

*Every mechanic is a potential feature. Build the engine to support them, then enable incrementally.*
