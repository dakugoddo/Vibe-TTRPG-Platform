/**
 * entitySerializer.ts
 * 
 * Converts Entity objects → Markdown files (with YAML frontmatter).
 * The output is a fully portable .md file that can be opened in Obsidian, VS Code, etc.
 * 
 * Format:
 * ---
 * type: character
 * tags: [огонь, магия]
 * properties:
 *   strength: { base: 18 }
 * ---
 * 
 * # Entity Name
 * 
 * Description content here...
 */

import type { Entity, EntityType } from '../types';

// ─── YAML Serialization (minimal, no dependencies) ───

function indent(str: string, level: number): string {
    return '  '.repeat(level) + str;
}

/** Serialize a JS value to YAML string */
function toYaml(value: unknown, level = 0): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') {
        // If string contains special chars, quote it
        if (
            value.includes(':') || value.includes('#') || value.includes('{') ||
            value.includes('}') || value.includes('[') || value.includes(']') ||
            value.includes(',') || value.includes('&') || value.includes('*') ||
            value.includes('?') || value.includes('|') || value.includes('-') ||
            value.includes('<') || value.includes('>') || value.includes('=') ||
            value.includes('!') || value.includes('%') || value.includes('@') ||
            value.includes('`') || value.includes('"') || value.includes("'") ||
            value.includes('\n') || value.trim() !== value ||
            value === '' || value === 'true' || value === 'false' || value === 'null' ||
            !isNaN(Number(value))
        ) {
            return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
        }
        return value;
    }
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        // Short arrays of primitives: inline format [a, b, c]
        if (value.every(v => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) {
            const items = value.map(v => toYaml(v, 0)).join(', ');
            if (items.length < 80) return `[${items}]`;
        }
        // Long/complex arrays: block format
        return '\n' + value.map(v => {
            const serialized = toYaml(v, level + 1);
            if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
                // Object in array
                const lines = serialized.trim().split('\n');
                return indent('- ' + lines[0], level) +
                    (lines.length > 1 ? '\n' + lines.slice(1).map(l => indent('  ' + l, level)).join('\n') : '');
            }
            return indent('- ' + serialized, level);
        }).join('\n');
    }
    if (typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>);
        if (entries.length === 0) return '{}';

        // Short objects with only primitive values: inline format { a: 1, b: 2 }
        if (entries.every(([, v]) => typeof v !== 'object' || v === null)) {
            const inline = entries.map(([k, v]) => `${k}: ${toYaml(v, 0)}`).join(', ');
            if (inline.length < 60) return `{ ${inline} }`;
        }

        // Block format
        return '\n' + entries.map(([key, val]) => {
            const serialized = toYaml(val, level + 1);
            if (serialized.startsWith('\n')) {
                return indent(`${key}:${serialized}`, level);
            }
            return indent(`${key}: ${serialized}`, level);
        }).join('\n');
    }
    return String(value);
}

// ─── Public API ───


/** Canvas-specific fields stored in frontmatter */
const CANVAS_FIELDS = ['grid', 'tokens', 'portals'] as const;

/** Tag-specific fields (extracted from properties) */
const TAG_FIELDS = ['category', 'modifiers', 'duration', 'icon'] as const;

/** Ability-specific fields (extracted from properties) */
const ABILITY_FIELDS = ['cost', 'range', 'area', 'dice', 'save'] as const;

interface SerializeOptions {
    /** If true, include uid in frontmatter (for user/GM databases) */
    includeUid?: boolean;
    /** Source entity name (for copies in user databases) */
    source?: string;
}

/**
 * Serialize an Entity to a Markdown string with YAML frontmatter.
 */
export function serializeEntity(entity: Entity, options: SerializeOptions = {}): string {
    const frontmatter: Record<string, unknown> = {};

    // Type (always first)
    frontmatter.type = entity.type;

    // UID (for user/GM databases)
    if (options.includeUid) {
        frontmatter.uid = entity.id;
    }

    // Source (for copies)
    if (options.source) {
        frontmatter.source = options.source;
    }

    // Image
    if (entity.imageId) {
        frontmatter.image = entity.imageId;
    }

    // Tags (by name or ID depending on context)
    if (entity.tags && entity.tags.length > 0) {
        frontmatter.tags = entity.tags;
    }

    // Type-specific frontmatter extraction from properties
    const props = { ...entity.properties };

    if (entity.type === 'tag') {
        // Extract tag-specific fields
        for (const field of TAG_FIELDS) {
            if (props[field] !== undefined) {
                frontmatter[field] = props[field];
                delete props[field];
            }
        }
    }

    if (entity.type === 'ability') {
        // Extract ability-specific fields
        for (const field of ABILITY_FIELDS) {
            if (props[field] !== undefined) {
                frontmatter[field] = props[field];
                delete props[field];
            }
        }
    }

    if (entity.type === 'canvas') {
        // Extract canvas-specific fields
        for (const field of CANVAS_FIELDS) {
            if (props[field] !== undefined) {
                frontmatter[field] = props[field];
                delete props[field];
            }
        }
    }

    if (entity.type === 'character') {
        // Extract stats and resources into top-level frontmatter keys
        const stats: Record<string, unknown> = {};
        const resources: Record<string, unknown> = {};
        const otherProps: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(props)) {
            if (key === 'x' || key === 'y') continue; // Canvas coordinates, skip in frontmatter
            if (value && typeof value === 'object' && 'base' in value) {
                if ('current' in value || 'max' in value) {
                    resources[key] = value;
                } else {
                    stats[key] = value.base;
                }
            } else {
                otherProps[key] = value;
            }
        }

        if (Object.keys(stats).length > 0) frontmatter.stats = stats;
        if (Object.keys(resources).length > 0) frontmatter.resources = resources;
        if (Object.keys(otherProps).length > 0) frontmatter.properties = otherProps;
    } else {
        // For non-character types, store remaining properties as-is
        // Remove canvas positioning (x, y) — that's runtime data
        delete props.x;
        delete props.y;
        delete props.targetCanvasId; // Portal runtime data

        if (Object.keys(props).length > 0) {
            frontmatter.properties = props;
        }
    }

    // Build YAML frontmatter string
    const yamlLines: string[] = [];
    for (const [key, value] of Object.entries(frontmatter)) {
        const serialized = toYaml(value, 1);
        if (serialized.startsWith('\n')) {
            yamlLines.push(`${key}:${serialized}`);
        } else {
            yamlLines.push(`${key}: ${serialized}`);
        }
    }

    // Build final document
    const parts: string[] = [];
    parts.push('---');
    parts.push(yamlLines.join('\n'));
    parts.push('---');
    parts.push('');

    // Title
    parts.push(`# ${entity.name}`);
    parts.push('');

    // Body (description)
    if (entity.description && entity.description.trim()) {
        parts.push(entity.description.trim());
        parts.push('');
    }

    return parts.join('\n');
}

/**
 * Generate a filename for an entity.
 * General DB: entity name becomes filename.
 * User/GM DB: entity name becomes filename (with dedup suffix if needed).
 */
export function entityToFilename(entity: Entity): string {
    // Sanitize filename: remove/replace invalid characters
    let name = entity.name
        .replace(/[<>:"/\\|?*]/g, '_')  // Invalid filename chars
        .replace(/\s+/g, ' ')            // Normalize whitespace
        .trim();

    if (!name) name = 'Untitled';

    return `${name}.md`;
}

/**
 * Determine the subfolder for an entity based on its type.
 */
export function entityTypeToFolder(type: EntityType): string {
    switch (type) {
        case 'character': return 'characters';
        case 'object': return 'objects';
        case 'ability': return 'abilities';
        case 'tag': return 'tags';
        case 'note': return 'notes';
        case 'canvas': return 'canvases';
        case 'portal': return 'portals';
        case 'folder': return 'folders';
        default: return 'misc';
    }
}
