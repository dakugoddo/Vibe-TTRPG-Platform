import {
    parseAndRollDice,
    rollD6Pool as rollD6PoolInternal,
    type DiceRollResult,
    type RandomInt,
} from '../utils/diceParser';

export interface RandomProvider {
    id: string;
    label: string;
    nextInt: RandomInt;
}

class LocalCryptoRandomProvider implements RandomProvider {
    id = 'local-crypto';
    label = 'Local crypto random';

    nextInt(minInclusive: number, maxInclusive: number): number {
        const min = Math.ceil(minInclusive);
        const max = Math.floor(maxInclusive);
        if (max < min) {
            throw new Error(`Invalid random range: ${minInclusive}..${maxInclusive}`);
        }

        const range = max - min + 1;
        const cryptoApi = globalThis.crypto;
        if (!cryptoApi?.getRandomValues) {
            return Math.floor(Math.random() * range) + min;
        }

        const bucketSize = 0x100000000;
        const limit = Math.floor(bucketSize / range) * range;
        const buffer = new Uint32Array(1);
        let value = bucketSize;

        while (value >= limit) {
            cryptoApi.getRandomValues(buffer);
            value = buffer[0];
        }

        return min + (value % range);
    }
}

/**
 * Future adapter placeholder.
 *
 * random.org is network-backed and should be wired as an async/buffered provider.
 * Keeping the class here documents the integration point without adding network
 * behavior to the local-first app yet.
 */
export class RandomOrgRandomProvider implements RandomProvider {
    id = 'random-org';
    label = 'random.org API';

    nextInt(): number {
        throw new Error('random.org provider is not configured yet. Use a buffered or async provider implementation.');
    }
}

const defaultProvider = new LocalCryptoRandomProvider();
let activeProvider: RandomProvider = defaultProvider;

function providerRandomInt(minInclusive: number, maxInclusive: number): number {
    return activeProvider.nextInt(minInclusive, maxInclusive);
}

function createRollError(rawCommand: string, error: unknown): DiceRollResult {
    const message = error instanceof Error ? error.message : String(error);
    return {
        rawCommand,
        total: 0,
        rolls: [],
        modifier: 0,
        notation: rawCommand,
        faces: 0,
        error: message,
    };
}

export function setRollRandomProvider(provider: RandomProvider) {
    activeProvider = provider;
}

export function resetRollRandomProvider() {
    activeProvider = defaultProvider;
}

export function getRollRandomProvider(): RandomProvider {
    return activeProvider;
}

export function rollDiceCommand(command: string): DiceRollResult | null {
    try {
        return parseAndRollDice(command, providerRandomInt);
    } catch (error) {
        return createRollError(command, error);
    }
}

export function rollDiceNotation(notation: string): DiceRollResult {
    const command = `/r ${notation}`;

    try {
        return parseAndRollDice(command, providerRandomInt) ?? createRollError(command, 'Неверная команда броска.');
    } catch (error) {
        return createRollError(command, error);
    }
}

export function rollD6Pool(count: number, label?: string): DiceRollResult {
    try {
        return rollD6PoolInternal(count, label, providerRandomInt);
    } catch (error) {
        return createRollError(label ?? `${count}d6`, error);
    }
}

export function formatRollMessage(expression: string, result: DiceRollResult): string {
    const rollsStr = result.rolls.length > 1 ? ` [${result.rolls.join(', ')}]` : '';
    const modifierStr = result.modifier !== 0 ? ` (${result.modifier > 0 ? '+' : ''}${result.modifier})` : '';
    const rollSum = result.rolls.reduce((total, roll) => total + roll, 0);

    return `🎲 ${expression.trim()}: **${result.total}**\n\n*${rollSum}${modifierStr}${rollsStr}*`;
}

export const rollEngine = {
    rollDiceCommand,
    rollDiceNotation,
    rollD6Pool,
    formatRollMessage,
    getRandomProvider: getRollRandomProvider,
    setRandomProvider: setRollRandomProvider,
    resetRandomProvider: resetRollRandomProvider,
};
