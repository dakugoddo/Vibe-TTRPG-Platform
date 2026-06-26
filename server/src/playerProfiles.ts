import fs from 'node:fs';
import path from 'node:path';
import type { PlayerProfile, UserRole } from './shared/types.js';

const PLAYER_ROLES: readonly UserRole[] = ['player', 'trusted-player', 'spectator', 'gm'];
const DEFAULT_PLAYER_ROLE: UserRole = 'player';

function getPlayersDir(worldPath: string): string {
    return path.join(worldPath, 'players');
}

function getUsersDir(worldPath: string): string {
    return path.join(worldPath, 'users');
}

function ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

export function normalizePlayerDisplayName(input: string): string {
    const normalized = input.trim().replace(/\s+/g, ' ');
    return normalized || 'Игрок';
}

function getNameKey(displayName: string): string {
    return normalizePlayerDisplayName(displayName).toLocaleLowerCase('ru-RU');
}

export function sanitizePlayerStorageRoot(displayName: string): string {
    const sanitized = normalizePlayerDisplayName(displayName)
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/[. ]+$/g, '')
        .trim();
    return sanitized || 'player';
}

function hashString(input: string): string {
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
    }
    return Math.abs(hash >>> 0).toString(36);
}

function isUserRole(value: unknown): value is UserRole {
    return typeof value === 'string' && (PLAYER_ROLES as readonly string[]).includes(value);
}

function isSafeRequestedPlayerId(value: string): boolean {
    return /^[a-zA-Z0-9_-]{3,80}$/.test(value);
}

function generatePlayerId(existingIds: Set<string>, requestedPlayerId?: string): string {
    if (requestedPlayerId && isSafeRequestedPlayerId(requestedPlayerId) && !existingIds.has(requestedPlayerId)) {
        return requestedPlayerId;
    }

    let id = '';
    do {
        id = `player_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    } while (existingIds.has(id));
    return id;
}

function readProfileFile(filePath: string): PlayerProfile | null {
    try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Partial<PlayerProfile>;
        if (!raw.playerId || !raw.displayName || !raw.storageRoot) return null;
        const now = new Date().toISOString();
        return {
            playerId: String(raw.playerId),
            displayName: normalizePlayerDisplayName(String(raw.displayName)),
            assignedRole: isUserRole(raw.assignedRole) ? raw.assignedRole : DEFAULT_PLAYER_ROLE,
            storageRoot: sanitizePlayerStorageRoot(String(raw.storageRoot)),
            createdAt: raw.createdAt || now,
            updatedAt: raw.updatedAt || now,
            lastSeenAt: raw.lastSeenAt,
        };
    } catch {
        return null;
    }
}

function writeProfile(worldPath: string, profile: PlayerProfile): void {
    const playersDir = getPlayersDir(worldPath);
    ensureDir(playersDir);
    fs.writeFileSync(
        path.join(playersDir, `${profile.playerId}.json`),
        `${JSON.stringify(profile, null, 2)}\n`,
        'utf-8'
    );
}

function listStoredPlayerProfiles(worldPath: string): PlayerProfile[] {
    const playersDir = getPlayersDir(worldPath);
    if (!fs.existsSync(playersDir)) return [];

    return fs.readdirSync(playersDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map((entry) => readProfileFile(path.join(playersDir, entry.name)))
        .filter((profile): profile is PlayerProfile => Boolean(profile))
        .sort((left, right) => left.displayName.localeCompare(right.displayName, 'ru'));
}

function listLegacyUserProfiles(worldPath: string, storedProfiles: PlayerProfile[]): PlayerProfile[] {
    const usersDir = getUsersDir(worldPath);
    if (!fs.existsSync(usersDir)) return [];

    const claimedStorageRoots = new Set(storedProfiles.map((profile) => profile.storageRoot.toLocaleLowerCase('ru-RU')));
    const now = new Date().toISOString();

    return fs.readdirSync(usersDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .filter((entry) => !claimedStorageRoots.has(entry.name.toLocaleLowerCase('ru-RU')))
        .map((entry) => ({
            playerId: `legacy_${hashString(entry.name)}`,
            displayName: entry.name,
            assignedRole: DEFAULT_PLAYER_ROLE,
            storageRoot: entry.name,
            createdAt: now,
            updatedAt: now,
            legacy: true,
        }));
}

function getUniqueStorageRoot(worldPath: string, displayName: string, profiles: PlayerProfile[]): string {
    const usersDir = getUsersDir(worldPath);
    const base = sanitizePlayerStorageRoot(displayName);
    const usedRoots = new Set(profiles.map((profile) => profile.storageRoot.toLocaleLowerCase('ru-RU')));
    const baseExists = fs.existsSync(path.join(usersDir, base));
    const canClaimExactLegacyRoot = base === displayName;

    if (!usedRoots.has(base.toLocaleLowerCase('ru-RU')) && (!baseExists || canClaimExactLegacyRoot)) {
        return base;
    }

    for (let index = 1; index < 1000; index++) {
        const candidate = `${base} (${index})`;
        if (!usedRoots.has(candidate.toLocaleLowerCase('ru-RU')) && !fs.existsSync(path.join(usersDir, candidate))) {
            return candidate;
        }
    }

    return `${base}-${Date.now().toString(36)}`;
}

export function listPlayerProfiles(worldPath: string): PlayerProfile[] {
    const storedProfiles = listStoredPlayerProfiles(worldPath);
    return [...storedProfiles, ...listLegacyUserProfiles(worldPath, storedProfiles)]
        .sort((left, right) => left.displayName.localeCompare(right.displayName, 'ru'));
}

export function claimPlayerProfile(
    worldPath: string,
    displayNameInput: string,
    options: { requestedPlayerId?: string } = {}
): PlayerProfile {
    const displayName = normalizePlayerDisplayName(displayNameInput);
    const profiles = listStoredPlayerProfiles(worldPath);
    const existingByName = profiles.find((profile) => getNameKey(profile.displayName) === getNameKey(displayName));
    const now = new Date().toISOString();

    ensureDir(getUsersDir(worldPath));

    if (existingByName) {
        const updatedProfile: PlayerProfile = {
            ...existingByName,
            lastSeenAt: now,
            updatedAt: now,
        };
        ensureDir(path.join(getUsersDir(worldPath), updatedProfile.storageRoot));
        writeProfile(worldPath, updatedProfile);
        return updatedProfile;
    }

    const existingIds = new Set(profiles.map((profile) => profile.playerId));
    const storageRoot = getUniqueStorageRoot(worldPath, displayName, profiles);
    const profile: PlayerProfile = {
        playerId: generatePlayerId(existingIds, options.requestedPlayerId),
        displayName,
        assignedRole: DEFAULT_PLAYER_ROLE,
        storageRoot,
        createdAt: now,
        updatedAt: now,
        lastSeenAt: now,
    };

    ensureDir(path.join(getUsersDir(worldPath), storageRoot));
    writeProfile(worldPath, profile);
    return profile;
}

export function updatePlayerProfileRole(worldPath: string, playerId: string, assignedRole: UserRole): PlayerProfile {
    if (!isUserRole(assignedRole) || assignedRole === 'gm') {
        throw new Error(`Unsupported player role: ${assignedRole}`);
    }

    const profiles = listStoredPlayerProfiles(worldPath);
    const profile = profiles.find((candidate) => candidate.playerId === playerId);
    if (!profile) {
        throw new Error(`Player profile not found: ${playerId}`);
    }

    const updatedProfile: PlayerProfile = {
        ...profile,
        assignedRole,
        updatedAt: new Date().toISOString(),
    };
    writeProfile(worldPath, updatedProfile);
    return updatedProfile;
}
