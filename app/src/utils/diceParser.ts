export interface DiceRollResult {
    rawCommand: string;
    total: number;
    rolls: number[];
    modifier: number;
    notation: string; // e.g. "2d6+3"
    faces: number;
    error?: string;
    isCritMax?: boolean;
    isCritMin?: boolean;
}

export type RandomInt = (minInclusive: number, maxInclusive: number) => number;

function defaultRandomInt(minInclusive: number, maxInclusive: number): number {
    return Math.floor(Math.random() * (maxInclusive - minInclusive + 1)) + minInclusive;
}

function rollDie(faces: number, randomInt: RandomInt): number {
    const roll = randomInt(1, faces);
    return Math.max(1, Math.min(faces, Math.trunc(roll)));
}

/**
 * Roll N d6 dice directly (for skill/competency checks).
 * Returns a DiceRollResult suitable for chat display.
 */
export function rollD6Pool(count: number, label?: string, randomInt: RandomInt = defaultRandomInt): DiceRollResult {
    const safeCount = Math.max(0, Math.min(100, count));
    const rolls: number[] = [];

    for (let i = 0; i < safeCount; i++) {
        rolls.push(rollDie(6, randomInt));
    }

    const total = rolls.reduce((a, b) => a + b, 0);
    const notation = label ? `${label}: ${safeCount}d6` : `${safeCount}d6`;

    return {
        rawCommand: notation,
        total,
        rolls,
        modifier: 0,
        notation,
        faces: 6,
        isCritMax: safeCount > 0 && rolls.every(r => r === 6),
        isCritMin: safeCount > 0 && rolls.every(r => r === 1),
    };
}

export function parseAndRollDice(command: string, randomInt: RandomInt = defaultRandomInt): DiceRollResult | null {
    const trimmed = command.trim();
    if (!trimmed.startsWith('/r ') && !trimmed.startsWith('/roll ')) {
        return null;
    }

    const notationRaw = trimmed.replace(/^\/r\s+/, '').replace(/^\/roll\s+/, '').trim();
    const notation = notationRaw.replace(/\s+/g, '').toLowerCase();
    const match = notation.match(/^(\d*)d(\d+)([+-]\d+)?$/);

    if (!match) {
        return {
            rawCommand: command,
            total: 0,
            rolls: [],
            modifier: 0,
            notation: notationRaw,
            faces: 0,
            error: 'Неверный формат дайсов. Допустимый формат: 1d20, 2d6+3, d100.',
        };
    }

    const countStr = match[1];
    const facesStr = match[2];
    const modStr = match[3];

    const count = countStr ? parseInt(countStr, 10) : 1;
    const faces = parseInt(facesStr, 10);
    const modifier = modStr ? parseInt(modStr, 10) : 0;

    if (count <= 0 || count > 100) {
        return {
            rawCommand: command,
            total: 0,
            rolls: [],
            modifier: 0,
            notation: notationRaw,
            faces: 0,
            error: 'Количество дайсов должно быть от 1 до 100.',
        };
    }

    if (faces <= 1 || faces > 1000) {
        return {
            rawCommand: command,
            total: 0,
            rolls: [],
            modifier: 0,
            notation: notationRaw,
            faces: 0,
            error: 'Грани дайса должны быть от 2 до 1000.',
        };
    }

    const rolls: number[] = [];
    let total = 0;

    for (let i = 0; i < count; i++) {
        const roll = rollDie(faces, randomInt);
        rolls.push(roll);
        total += roll;
    }

    total += modifier;

    return {
        rawCommand: command,
        total,
        rolls,
        modifier,
        faces,
        notation: `${count}d${faces}${modStr ? (modifier > 0 ? '+' : '') + modifier : ''}`,
        isCritMax: rolls.length > 0 && rolls.every(r => r === faces),
        isCritMin: rolls.length > 0 && rolls.every(r => r === 1),
    };
}
