export interface DiceRollResult {
    rawCommand: string;
    total: number;
    rolls: number[];
    modifier: number;
    notation: string; // e.g., "2d6+3"
    faces: number;    // Number of sides on the dice
    error?: string;
    isCritMax?: boolean;  // All dice rolled max
    isCritMin?: boolean;  // All dice rolled 1
}

export function parseAndRollDice(command: string): DiceRollResult | null {
    const trimmed = command.trim();
    if (!trimmed.startsWith('/r ') && !trimmed.startsWith('/roll ')) {
        return null;
    }

    const notationRaw = trimmed.replace(/^\/r\s+/, '').replace(/^\/roll\s+/, '').trim();
    // Remove spaces from notation for easier parsing
    const notation = notationRaw.replace(/\s+/g, '').toLowerCase();

    // Regex to match formats like '2d6', 'd20', '3d8+5', '1d10-2'
    const match = notation.match(/^(\d*)d(\d+)([+-]\d+)?$/);

    if (!match) {
        return {
            rawCommand: command,
            total: 0,
            rolls: [],
            modifier: 0,
            notation: notationRaw,
            faces: 0,
            error: "Неверный формат дайсов. Допустимый формат: 1d20, 2d6+3, d100."
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
            error: "Количество дайсов должно быть от 1 до 100."
        };
    }

    if (faces <= 1 || Math.max(faces) > 1000) {
        return {
            rawCommand: command,
            total: 0,
            rolls: [],
            modifier: 0,
            notation: notationRaw,
            faces: 0,
            error: "Грани дайса должны быть от 2 до 1000."
        };
    }

    const rolls: number[] = [];
    let total = 0;

    for (let i = 0; i < count; i++) {
        const roll = Math.floor(Math.random() * faces) + 1;
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
        isCritMin: rolls.length > 0 && rolls.every(r => r === 1)
    };
}
