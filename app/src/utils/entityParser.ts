/**
 * entityParser.ts
 * 
 * Parses Markdown files with YAML frontmatter → Entity objects.
 * Supports the Vibe TTRPG custom format.
 * 
 * Input:
 * ---
 * type: character
 * tags: [огонь, магия]
 * stats:
 *   strength: 18
 * ---
 * 
 * # Entity Name
 * 
 * Description content...
 * 
 * Output: Entity object
 */

import type { Entity, EntityType } from '../types';

// ─── YAML Parser (minimal, no dependencies) ───

const VALID_ENTITY_TYPES: EntityType[] = [
    'character', 'object', 'ability', 'tag', 'canvas', 'note', 'portal', 'folder'
];

/**
 * Parse a simple YAML string into a JS object.
 * Supports: strings, numbers, booleans, null, arrays (inline & block), objects (inline & block).
 */
function parseYaml(yamlStr: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = yamlStr.split('\n');
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        // Skip empty lines and comments
        if (!line.trim() || line.trim().startsWith('#')) {
            i++;
            continue;
        }

        const indent = line.search(/\S/);
        if (indent > 0) {
            // This is a nested line, skip (handled by parseValue)
            i++;
            continue;
        }

        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) {
            i++;
            continue;
        }

        const key = line.substring(0, colonIdx).trim();
        const rawValue = line.substring(colonIdx + 1).trim();

        const { value, nextLine } = parseValue(rawValue, lines, i, 0);
        result[key] = value;
        i = nextLine;
    }

    return result;
}

interface ParseResult {
    value: unknown;
    nextLine: number;
}

function parseValue(rawValue: string, lines: string[], currentLine: number, parentIndent: number): ParseResult {
    // Empty value → check for block content on next lines
    if (!rawValue) {
        return parseBlockValue(lines, currentLine + 1, parentIndent);
    }

    // Inline array: [a, b, c]
    if (rawValue.startsWith('[')) {
        return { value: parseInlineArray(rawValue), nextLine: currentLine + 1 };
    }

    // Inline object: { a: 1, b: 2 }
    if (rawValue.startsWith('{')) {
        return { value: parseInlineObject(rawValue), nextLine: currentLine + 1 };
    }

    // Quoted string
    if ((rawValue.startsWith('"') && rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
        const str = rawValue.slice(1, -1)
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
        return { value: str, nextLine: currentLine + 1 };
    }

    // Boolean
    if (rawValue === 'true') return { value: true, nextLine: currentLine + 1 };
    if (rawValue === 'false') return { value: false, nextLine: currentLine + 1 };

    // Null
    if (rawValue === 'null' || rawValue === '~') return { value: null, nextLine: currentLine + 1 };

    // Number
    const num = Number(rawValue);
    if (!isNaN(num) && rawValue !== '') return { value: num, nextLine: currentLine + 1 };

    // Plain string
    return { value: rawValue, nextLine: currentLine + 1 };
}

function parseBlockValue(lines: string[], startLine: number, parentIndent: number): ParseResult {
    if (startLine >= lines.length) return { value: null, nextLine: startLine };

    const firstContentLine = lines[startLine];
    if (!firstContentLine || !firstContentLine.trim()) return { value: null, nextLine: startLine + 1 };

    const childIndent = firstContentLine.search(/\S/);
    if (childIndent <= parentIndent) return { value: null, nextLine: startLine };

    // Check if it's an array (starts with "- ")
    if (firstContentLine.trim().startsWith('- ')) {
        return parseBlockArray(lines, startLine, childIndent);
    }

    // Otherwise it's an object
    return parseBlockObject(lines, startLine, childIndent);
}

function parseBlockObject(lines: string[], startLine: number, expectedIndent: number): ParseResult {
    const result: Record<string, unknown> = {};
    let i = startLine;

    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) { i++; continue; }

        const indent = line.search(/\S/);
        if (indent < expectedIndent) break;
        if (indent > expectedIndent) { i++; continue; }

        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) { i++; continue; }

        const key = line.substring(0, colonIdx).trim();
        const rawValue = line.substring(colonIdx + 1).trim();

        const { value, nextLine } = parseValue(rawValue, lines, i, indent);
        result[key] = value;
        i = nextLine;
    }

    return { value: result, nextLine: i };
}

function parseBlockArray(lines: string[], startLine: number, expectedIndent: number): ParseResult {
    const result: unknown[] = [];
    let i = startLine;

    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) { i++; continue; }

        const indent = line.search(/\S/);
        if (indent < expectedIndent) break;
        if (!line.trim().startsWith('- ')) { i++; continue; }

        const itemValue = line.trim().substring(2).trim();

        // Check for inline object: - { key: value, ... }
        if (itemValue.startsWith('{')) {
            result.push(parseInlineObject(itemValue));
            i++;
            continue;
        }

        // Check for inline array: - [a, b, c]
        if (itemValue.startsWith('[')) {
            result.push(parseInlineArray(itemValue));
            i++;
            continue;
        }

        // Check if item has a colon (block object item)
        if (itemValue.includes(':') && !itemValue.startsWith('"') && !itemValue.startsWith("'")) {
            // Could be an inline object item or start of block object
            const colonIdx = itemValue.indexOf(':');
            const key = itemValue.substring(0, colonIdx).trim();
            const val = itemValue.substring(colonIdx + 1).trim();

            // Parse as object starting from this key
            const obj: Record<string, unknown> = {};
            const { value: firstVal, nextLine } = parseValue(val, lines, i, indent + 2);
            obj[key] = firstVal;

            // Check for more keys at deeper indent
            let j = nextLine;
            while (j < lines.length) {
                const nextLine2 = lines[j];
                if (!nextLine2.trim()) { j++; continue; }
                const nextIndent = nextLine2.search(/\S/);
                if (nextIndent <= indent) break;
                if (nextIndent <= indent + 1) break;

                const nc = nextLine2.indexOf(':');
                if (nc === -1) { j++; continue; }
                const nk = nextLine2.substring(0, nc).trim();
                const nv = nextLine2.substring(nc + 1).trim();
                const { value: nVal, nextLine: nl } = parseValue(nv, lines, j, nextIndent);
                obj[nk] = nVal;
                j = nl;
            }
            result.push(Object.keys(obj).length === 1 && typeof obj[key] !== 'object' ? obj : obj);
            i = j;
        } else {
            const { value, nextLine } = parseValue(itemValue, lines, i, indent);
            result.push(value);
            i = nextLine;
        }
    }

    return { value: result, nextLine: i };
}

function parseInlineArray(str: string): unknown[] {
    // Remove brackets
    const inner = str.slice(1, -1).trim();
    if (!inner) return [];

    // Split by comma, respecting nested brackets and quotes
    const items: string[] = [];
    let current = '';
    let depth = 0;
    let inQuote: string | null = null;

    for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];
        if (inQuote) {
            current += ch;
            if (ch === inQuote && inner[i - 1] !== '\\') inQuote = null;
        } else if (ch === '"' || ch === "'") {
            inQuote = ch;
            current += ch;
        } else if (ch === '[' || ch === '{') {
            depth++;
            current += ch;
        } else if (ch === ']' || ch === '}') {
            depth--;
            current += ch;
        } else if (ch === ',' && depth === 0) {
            items.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    if (current.trim()) items.push(current.trim());

    return items.map(item => {
        if (item.startsWith('{')) return parseInlineObject(item);
        if (item.startsWith('[')) return parseInlineArray(item);
        if ((item.startsWith('"') && item.endsWith('"')) ||
            (item.startsWith("'") && item.endsWith("'"))) {
            return item.slice(1, -1);
        }
        if (item === 'true') return true;
        if (item === 'false') return false;
        if (item === 'null') return null;
        const n = Number(item);
        if (!isNaN(n) && item !== '') return n;
        return item;
    });
}

function parseInlineObject(str: string): Record<string, unknown> {
    const inner = str.slice(1, -1).trim();
    if (!inner) return {};

    const result: Record<string, unknown> = {};
    let current = '';
    let depth = 0;
    let inQuote: string | null = null;
    const pairs: string[] = [];

    for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];
        if (inQuote) {
            current += ch;
            if (ch === inQuote && inner[i - 1] !== '\\') inQuote = null;
        } else if (ch === '"' || ch === "'") {
            inQuote = ch;
            current += ch;
        } else if (ch === '{' || ch === '[') {
            depth++;
            current += ch;
        } else if (ch === '}' || ch === ']') {
            depth--;
            current += ch;
        } else if (ch === ',' && depth === 0) {
            pairs.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    if (current.trim()) pairs.push(current.trim());

    for (const pair of pairs) {
        const colonIdx = pair.indexOf(':');
        if (colonIdx === -1) continue;
        const key = pair.substring(0, colonIdx).trim();
        let value: string | unknown = pair.substring(colonIdx + 1).trim();

        // Parse value
        if (typeof value === 'string') {
            if (value.startsWith('{')) value = parseInlineObject(value);
            else if (value.startsWith('[')) value = parseInlineArray(value);
            else if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'")))
                value = (value as string).slice(1, -1);
            else if (value === 'true') value = true;
            else if (value === 'false') value = false;
            else if (value === 'null') value = null;
            else {
                const n = Number(value);
                if (!isNaN(n) && value !== '') value = n;
            }
        }
        result[key] = value;
    }

    return result;
}

// ─── Public API ───

export interface ParsedEntity {
    entity: Entity;
    /** Original frontmatter data (for round-trip preservation) */
    rawFrontmatter: Record<string, unknown>;
}

/**
 * Parse a Markdown file content into an Entity.
 * 
 * @param content - The full markdown file content
 * @param fallbackId - ID to use if none is found in frontmatter (for General DB: derived from filename)
 */
export function parseEntityFile(content: string, fallbackId: string): ParsedEntity {
    const { frontmatter, body } = splitFrontmatter(content);
    const parsed = frontmatter ? parseYaml(frontmatter) : {};

    // Extract title from body (first # heading)
    const titleMatch = body.match(/^#\s+(.+)$/m);
    const name = titleMatch ? titleMatch[1].trim() : fallbackId;

    // Remove the title line from description
    const description = titleMatch
        ? body.replace(/^#\s+.+\n?/, '').trim()
        : body.trim();

    // Determine type
    const type = (VALID_ENTITY_TYPES.includes(parsed.type as EntityType)
        ? parsed.type
        : 'note') as EntityType;

    // Determine ID
    const id = (parsed.uid as string) || fallbackId;

    // Tags
    const tags = Array.isArray(parsed.tags)
        ? parsed.tags.map(String)
        : [];

    // Image
    const imageId = parsed.image as string | undefined;

    // Build properties based on entity type
    const properties: Record<string, unknown> = {};

    if (type === 'character') {
        // Convert stats → { statName: { base: value } }
        if (parsed.stats && typeof parsed.stats === 'object') {
            for (const [key, value] of Object.entries(parsed.stats as Record<string, unknown>)) {
                properties[key] = { base: value };
            }
        }
        // Convert resources → keep as-is (already have max/current)
        if (parsed.resources && typeof parsed.resources === 'object') {
            for (const [key, value] of Object.entries(parsed.resources as Record<string, unknown>)) {
                properties[key] = value;
            }
        }
        // Merge any extra properties
        if (parsed.properties && typeof parsed.properties === 'object') {
            Object.assign(properties, parsed.properties);
        }
    } else if (type === 'tag') {
        // Tag-specific fields → properties
        for (const field of ['category', 'modifiers', 'duration', 'icon'] as const) {
            if (parsed[field] !== undefined) {
                properties[field] = parsed[field];
            }
        }
        if (parsed.properties && typeof parsed.properties === 'object') {
            Object.assign(properties, parsed.properties);
        }
    } else if (type === 'ability') {
        // Ability-specific fields → properties
        for (const field of ['cost', 'range', 'area', 'dice', 'save'] as const) {
            if (parsed[field] !== undefined) {
                properties[field] = parsed[field];
            }
        }
        if (parsed.properties && typeof parsed.properties === 'object') {
            Object.assign(properties, parsed.properties);
        }
    } else if (type === 'canvas') {
        // Canvas-specific fields → properties
        for (const field of ['grid', 'tokens', 'portals'] as const) {
            if (parsed[field] !== undefined) {
                properties[field] = parsed[field];
            }
        }
        if (parsed.properties && typeof parsed.properties === 'object') {
            Object.assign(properties, parsed.properties);
        }
    } else {
        // Generic: just use properties as-is
        if (parsed.properties && typeof parsed.properties === 'object') {
            Object.assign(properties, parsed.properties);
        }
    }

    const entity: Entity = {
        id,
        parentId: null, // Determined by folder structure, not frontmatter
        type,
        name,
        description,
        tags,
        properties,
        ...(imageId ? { imageId } : {}),
    };

    return {
        entity,
        rawFrontmatter: parsed,
    };
}

/**
 * Split a markdown file into frontmatter and body.
 */
function splitFrontmatter(content: string): { frontmatter: string | null; body: string } {
    const trimmed = content.trim();

    if (!trimmed.startsWith('---')) {
        return { frontmatter: null, body: trimmed };
    }

    const endIdx = trimmed.indexOf('---', 3);
    if (endIdx === -1) {
        return { frontmatter: null, body: trimmed };
    }

    const frontmatter = trimmed.substring(3, endIdx).trim();
    const body = trimmed.substring(endIdx + 3).trim();

    return { frontmatter, body };
}

/**
 * Extract entity name from a filename.
 * "Экскалибур.md" → "Экскалибур"
 * "Зелье (2).md" → "Зелье (2)"
 */
export function filenameToEntityName(filename: string): string {
    return filename.replace(/\.md$/i, '');
}
