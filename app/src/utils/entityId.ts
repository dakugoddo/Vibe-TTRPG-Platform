let lastGeneratedAt = 0;

function pad(value: number, length: number): string {
    return String(value).padStart(length, '0');
}

export function formatEntityTimestampId(date: Date): string {
    return [
        pad(date.getFullYear(), 4),
        pad(date.getMonth() + 1, 2),
        pad(date.getDate(), 2),
        pad(date.getHours(), 2),
        pad(date.getMinutes(), 2),
        pad(date.getSeconds(), 2),
        pad(date.getMilliseconds(), 3),
    ].join('');
}

export function generateEntityId(existingIds: Iterable<string> = []): string {
    const occupied = new Set(existingIds);
    let candidateTime = Math.max(Date.now(), lastGeneratedAt + 1);
    let candidate = formatEntityTimestampId(new Date(candidateTime));

    while (occupied.has(candidate)) {
        candidateTime += 1;
        candidate = formatEntityTimestampId(new Date(candidateTime));
    }

    lastGeneratedAt = candidateTime;
    return candidate;
}

export function isTimestampEntityId(value: string): boolean {
    return /^\d{17}$/.test(value);
}
