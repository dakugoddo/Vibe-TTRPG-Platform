import fs from 'node:fs';
import path from 'node:path';

export interface WorldLocaleFile {
    locale: string;
    filename: string;
    size: number;
    modifiedAt: string;
}

export interface WorldLocaleDiagnostic {
    level: 'error' | 'warning';
    message: string;
}

export interface WorldLocaleReadResult {
    locale: string;
    exists: boolean;
    overrides: Record<string, unknown>;
    diagnostics: WorldLocaleDiagnostic[];
    size?: number;
    modifiedAt?: string;
}

export interface WorldLocaleWriteResult extends WorldLocaleReadResult {
    backupCreated: boolean;
}

export interface WorldLocaleRollbackResult extends WorldLocaleReadResult {
    restored: boolean;
}

const WORLD_LOCALE_ID_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;

export function isWorldLocaleId(value: unknown): value is string {
    return typeof value === 'string' && WORLD_LOCALE_ID_PATTERN.test(value);
}

function getWorldLocalesDir(worldPath: string): string {
    return path.join(worldPath, 'locales');
}

export function resolveWorldLocalePath(worldPath: string, locale: string): string {
    if (!isWorldLocaleId(locale)) {
        throw new Error(`Invalid locale id: ${locale}`);
    }
    return path.join(getWorldLocalesDir(worldPath), `${locale}.json`);
}

export function listWorldLocaleFiles(worldPath: string): WorldLocaleFile[] {
    const localesDir = getWorldLocalesDir(worldPath);
    if (!fs.existsSync(localesDir)) return [];

    return fs.readdirSync(localesDir, { withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => {
            const locale = entry.name.replace(/\.json$/i, '');
            return { entry, locale };
        })
        .filter(({ entry, locale }) => entry.name.endsWith('.json') && isWorldLocaleId(locale))
        .map(({ entry, locale }) => {
            const filePath = path.join(localesDir, entry.name);
            const stat = fs.statSync(filePath);
            return {
                locale,
                filename: entry.name,
                size: stat.size,
                modifiedAt: stat.mtime.toISOString(),
            };
        })
        .sort((left, right) => left.locale.localeCompare(right.locale));
}

export function readWorldLocaleFile(worldPath: string, locale: string): WorldLocaleReadResult {
    const filePath = resolveWorldLocalePath(worldPath, locale);
    if (!fs.existsSync(filePath)) {
        return {
            locale,
            exists: false,
            overrides: {},
            diagnostics: [],
        };
    }

    const stat = fs.statSync(filePath);
    const result: WorldLocaleReadResult = {
        locale,
        exists: true,
        overrides: {},
        diagnostics: [],
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
    };

    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            result.diagnostics.push({
                level: 'error',
                message: 'Locale file must be a JSON object.',
            });
            return result;
        }
        result.overrides = parsed as Record<string, unknown>;
    } catch (err) {
        result.diagnostics.push({
            level: 'error',
            message: err instanceof Error ? err.message : String(err),
        });
    }

    return result;
}

function assertLocaleOverrides(value: unknown): asserts value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Locale overrides must be a JSON object.');
    }
}

export function writeWorldLocaleFile(worldPath: string, locale: string, overrides: unknown): WorldLocaleWriteResult {
    assertLocaleOverrides(overrides);

    const filePath = resolveWorldLocalePath(worldPath, locale);
    const localesDir = path.dirname(filePath);
    const backupPath = `${filePath}.bak`;
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    const hadExistingFile = fs.existsSync(filePath);
    const previousContent = hadExistingFile ? fs.readFileSync(filePath, 'utf-8') : null;

    fs.mkdirSync(localesDir, { recursive: true });

    try {
        if (hadExistingFile) {
            fs.copyFileSync(filePath, backupPath);
        }

        fs.writeFileSync(tempPath, `${JSON.stringify(overrides, null, 2)}\n`, 'utf-8');
        fs.renameSync(tempPath, filePath);

        return {
            ...readWorldLocaleFile(worldPath, locale),
            backupCreated: hadExistingFile,
        };
    } catch (err) {
        if (fs.existsSync(tempPath)) {
            fs.rmSync(tempPath, { force: true });
        }

        if (previousContent !== null) {
            fs.writeFileSync(filePath, previousContent, 'utf-8');
        } else if (fs.existsSync(filePath)) {
            fs.rmSync(filePath, { force: true });
        }

        throw err;
    }
}

export function rollbackWorldLocaleFile(worldPath: string, locale: string): WorldLocaleRollbackResult {
    const filePath = resolveWorldLocalePath(worldPath, locale);
    const backupPath = `${filePath}.bak`;

    if (!fs.existsSync(backupPath)) {
        throw new Error(`No backup found for locale: ${locale}`);
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.copyFileSync(backupPath, filePath);

    return {
        ...readWorldLocaleFile(worldPath, locale),
        restored: true,
    };
}
