export function extractProjectNumber(value: string | null | undefined): number | null {
    if (!value) return null;
    const digits = value.replace(/\D/g, '');
    if (!digits) return null;

    const parsed = Number.parseInt(digits, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function findNextAvailableProjectNumber(usedNumbers: number[]): number {
    const positive = Array.from(
        new Set(usedNumbers.filter((num) => Number.isInteger(num) && num > 0))
    ).sort((a, b) => a - b);

    let expected = 1;
    for (const num of positive) {
        if (num > expected) return expected;
        if (num === expected) expected++;
    }
    return expected;
}

export function formatProjectNumber(num: number): string {
    return `PRJ-${String(num).padStart(3, '0')}`;
}
