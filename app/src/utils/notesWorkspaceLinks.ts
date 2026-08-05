import type { Entity } from '../types';
import type { NotesWorkspaceView } from './notesWorkspaceLayout';

export type NotesWorkspaceLinkedViewSection = 'outline' | 'outgoingLinks' | 'backlinks';

export interface NotesWorkspaceHeading {
    id: string;
    level: number;
    text: string;
    line: number;
}

export interface NotesWorkspaceWikiLink {
    raw: string;
    target: string;
    label?: string;
    heading?: string;
    resolvedEntityId?: string;
}

export interface NotesWorkspaceLinkedViews {
    outline: NotesWorkspaceHeading[];
    outgoingLinks: NotesWorkspaceWikiLink[];
    backlinks: Entity[];
}

function slugifyHeading(value: string): string {
    const slug = value
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return slug || 'heading';
}

function normalizeWikiTarget(target: string): string {
    return target
        .split('|')[0]
        .split('#')[0]
        .trim()
        .toLowerCase();
}

function parseWikiLinkTarget(source: string): Omit<NotesWorkspaceWikiLink, 'raw' | 'resolvedEntityId'> {
    const [targetAndHeadingRaw, ...labelParts] = source.split('|');
    const [targetRaw, ...headingParts] = targetAndHeadingRaw.split('#');
    const target = targetRaw.trim();
    const heading = headingParts.join('#').trim();
    const label = labelParts.join('|').trim();

    return {
        target,
        ...(label ? { label } : {}),
        ...(heading ? { heading } : {}),
    };
}

function resolveWikiTarget(target: string, entities: readonly Entity[]): string | undefined {
    const normalizedTarget = normalizeWikiTarget(target);
    return entities.find((entity) =>
        entity.id.trim().toLowerCase() === normalizedTarget
        || entity.name.trim().toLowerCase() === normalizedTarget
    )?.id;
}

export function extractNotesWorkspaceOutline(markdown: string): NotesWorkspaceHeading[] {
    const seen = new Map<string, number>();
    let insideFence = false;

    return markdown
        .split(/\r?\n/)
        .flatMap((line, index) => {
            if (/^\s*```/.test(line)) {
                insideFence = !insideFence;
                return [];
            }

            if (insideFence) return [];

            const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
            if (!match) return [];

            const text = match[2].replace(/\s+#+$/, '').trim();
            if (!text) return [];

            const baseId = slugifyHeading(text);
            const count = seen.get(baseId) ?? 0;
            seen.set(baseId, count + 1);

            return [{
                id: count === 0 ? baseId : `${baseId}-${count + 1}`,
                level: match[1].length,
                text,
                line: index + 1,
            }];
        });
}

export function extractNotesWorkspaceWikiLinks(
    markdown: string,
    entities: readonly Entity[] = []
): NotesWorkspaceWikiLink[] {
    const links: NotesWorkspaceWikiLink[] = [];
    const wikiPattern = /\[\[([^\]]+)\]\]/g;
    let match: RegExpExecArray | null;

    while ((match = wikiPattern.exec(markdown)) !== null) {
        const parsed = parseWikiLinkTarget(match[1]);
        links.push({
            raw: match[0],
            ...parsed,
            resolvedEntityId: resolveWikiTarget(parsed.target, entities),
        });
    }

    return links;
}

export function hasNotesWorkspaceWikiLinkToEntity(source: Entity, target: Entity): boolean {
    if (!source.description) return false;

    const normalizedTargets = new Set([
        target.id.trim().toLowerCase(),
        target.name.trim().toLowerCase(),
    ]);

    return extractNotesWorkspaceWikiLinks(source.description).some((link) =>
        normalizedTargets.has(normalizeWikiTarget(link.target))
    );
}

export function getNotesWorkspaceLinkedViewSections(view: NotesWorkspaceView): NotesWorkspaceLinkedViewSection[] {
    if (view === 'outline') return ['outline'];
    if (view === 'backlinks') return ['backlinks'];
    return ['outline', 'outgoingLinks', 'backlinks'];
}

export function buildNotesWorkspaceLinkedViews(
    entity: Entity,
    visibleEntities: readonly Entity[]
): NotesWorkspaceLinkedViews {
    return {
        outline: extractNotesWorkspaceOutline(entity.description ?? ''),
        outgoingLinks: extractNotesWorkspaceWikiLinks(entity.description ?? '', visibleEntities),
        backlinks: visibleEntities
            .filter((candidate) => candidate.id !== entity.id)
            .filter((candidate) => hasNotesWorkspaceWikiLinkToEntity(candidate, entity))
            .sort((left, right) => left.name.localeCompare(right.name, 'ru', { sensitivity: 'base' })),
    };
}
