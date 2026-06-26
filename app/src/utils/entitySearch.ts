import type { Entity } from '../types';

type TagNameResolver = (tagId: string) => string | undefined;
export type EntitySearchMatchField = 'name' | 'description' | 'property' | 'tag' | 'type' | 'id' | 'database';
export type EntitySearchPropertyOperator = ':' | '=' | '>' | '>=' | '<' | '<=';

export interface EntitySearchPropertyFilter {
  path: string;
  operator: EntitySearchPropertyOperator;
  value: string;
  normalizedPath: string;
  normalizedValue: string;
  numericValue: number | null;
}

export interface ParsedEntitySearchQuery {
  raw: string;
  normalizedFreeText: string;
  terms: string[];
  phrases: string[];
  filters: {
    types: string[];
    tags: string[];
    databases: string[];
    properties: EntitySearchPropertyFilter[];
  };
}

export interface EntitySearchResult {
  matches: boolean;
  score: number;
  matchedFields: EntitySearchMatchField[];
  matchedTerms: string[];
  snippet: string;
}

interface SearchField {
  field: EntitySearchMatchField;
  text: string;
  weight: number;
}

interface PropertySearchEntry {
  path: string;
  key: string;
  text: string;
  normalizedPath: string;
  normalizedKey: string;
  normalizedText: string;
  numericValue: number | null;
}

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_/\\|:;,.()[\]{}"'`!?@#$%^&*+=<>~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getEntitySearchTerms(query: string): string[] {
  const parsed = parseEntitySearchQuery(query);
  return [...parsed.phrases, ...parsed.terms].filter(Boolean);
}

export function normalizeEntitySearchHistoryQuery(query: string): string {
  return query.replace(/\s+/g, ' ').trim();
}

export function addRecentEntitySearchQuery(history: string[], query: string, maxItems = 8): string[] {
  const normalized = normalizeEntitySearchHistoryQuery(query);
  if (!normalized) return history;

  const normalizedKey = normalized.toLowerCase();
  return [
    normalized,
    ...history.filter((item) => normalizeEntitySearchHistoryQuery(item).toLowerCase() !== normalizedKey),
  ].slice(0, Math.max(1, maxItems));
}

export function addSavedEntitySearchQuery(savedQueries: string[], query: string, maxItems = 12): string[] {
  const normalized = normalizeEntitySearchHistoryQuery(query);
  if (!normalized) return savedQueries;

  const normalizedKey = normalized.toLowerCase();
  return [
    normalized,
    ...savedQueries.filter((item) => normalizeEntitySearchHistoryQuery(item).toLowerCase() !== normalizedKey),
  ].slice(0, Math.max(1, maxItems));
}

export function removeSavedEntitySearchQuery(savedQueries: string[], query: string): string[] {
  const normalizedKey = normalizeEntitySearchHistoryQuery(query).toLowerCase();
  if (!normalizedKey) return savedQueries;
  return savedQueries.filter((item) => normalizeEntitySearchHistoryQuery(item).toLowerCase() !== normalizedKey);
}

const ENTITY_TYPE_ALIASES: Record<string, string> = {
  character: 'character',
  characters: 'character',
  pc: 'character',
  npc: 'character',
  персонаж: 'character',
  персонажи: 'character',
  object: 'object',
  objects: 'object',
  item: 'object',
  предмет: 'object',
  предметы: 'object',
  ability: 'ability',
  abilities: 'ability',
  способность: 'ability',
  способности: 'ability',
  competency: 'competency',
  competencies: 'competency',
  компетенция: 'competency',
  компетенции: 'competency',
  attack: 'attack',
  attacks: 'attack',
  атака: 'attack',
  атаки: 'attack',
  note: 'note',
  notes: 'note',
  заметка: 'note',
  заметки: 'note',
  tag: 'tag',
  tags: 'tag',
  тег: 'tag',
  теги: 'tag',
  canvas: 'canvas',
  canvases: 'canvas',
  пространство: 'canvas',
  пространства: 'canvas',
  folder: 'folder',
  folders: 'folder',
  папка: 'folder',
  папки: 'folder',
};

const DATABASE_ALIASES: Record<string, string> = {
  general: 'general',
  global: 'general',
  общая: 'general',
  база: 'general',
  user: 'user',
  users: 'user',
  player: 'user',
  players: 'user',
  игрок: 'user',
  игроки: 'user',
  gm: 'gm',
  game_master: 'gm',
  мастер: 'gm',
  гм: 'gm',
};

function stripWrappingQuotes(value: string): string {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) return value.slice(1, -1);
  return value;
}

function tokenizeSearchQuery(query: string): Array<{ raw: string; quoted: boolean }> {
  const matches = query.match(/"[^"]+"|'[^']+'|\S+/g) ?? [];
  return matches.map((raw) => {
    const quoted = (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"));
    return { raw: stripWrappingQuotes(raw), quoted };
  });
}

function normalizeEntityTypeFilter(value: string): string {
  const normalized = normalizeSearchText(stripWrappingQuotes(value));
  return ENTITY_TYPE_ALIASES[normalized] ?? normalized;
}

function normalizeDatabaseFilter(value: string): string {
  const normalized = normalizeSearchText(stripWrappingQuotes(value));
  return DATABASE_ALIASES[normalized] ?? normalized;
}

function toFiniteNumber(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePropertyFilterValue(value: string): EntitySearchPropertyFilter | null {
  const raw = stripWrappingQuotes(value).trim();
  const match = raw.match(/^(.*?)(>=|<=|=|>|<|:)(.+)$/);
  if (!match) return null;

  const path = match[1]?.trim() ?? '';
  const operator = match[2] as EntitySearchPropertyOperator;
  const filterValue = stripWrappingQuotes(match[3]?.trim() ?? '');
  const normalizedPath = normalizeSearchText(path);
  const normalizedValue = normalizeSearchText(filterValue);

  if (!normalizedPath || !normalizedValue) return null;

  return {
    path,
    operator,
    value: filterValue,
    normalizedPath,
    normalizedValue,
    numericValue: toFiniteNumber(filterValue),
  };
}

function splitFilterToken(raw: string): { key: string; value: string } | null {
  if (raw.startsWith('#') && raw.length > 1) return { key: 'tag', value: raw.slice(1) };
  const separatorIndex = raw.indexOf(':');
  if (separatorIndex <= 0 || separatorIndex === raw.length - 1) return null;
  return {
    key: normalizeSearchText(raw.slice(0, separatorIndex)),
    value: raw.slice(separatorIndex + 1),
  };
}

export function parseEntitySearchQuery(query: string): ParsedEntitySearchQuery {
  const terms: string[] = [];
  const phrases: string[] = [];
  const filters: ParsedEntitySearchQuery['filters'] = {
    types: [],
    tags: [],
    databases: [],
    properties: [],
  };

  for (const token of tokenizeSearchQuery(query)) {
    const filter = splitFilterToken(token.raw);
    if (filter) {
      if (filter.key === 'type' || filter.key === 'тип' || filter.key === 'is') {
        const type = normalizeEntityTypeFilter(filter.value);
        if (type) filters.types.push(type);
        continue;
      }
      if (filter.key === 'tag' || filter.key === 'тег') {
        const tag = normalizeSearchText(filter.value);
        if (tag) filters.tags.push(tag);
        continue;
      }
      if (filter.key === 'db' || filter.key === 'database' || filter.key === 'база' || filter.key === 'in') {
        const database = normalizeDatabaseFilter(filter.value);
        if (database) filters.databases.push(database);
        continue;
      }
      if (filter.key === 'prop' || filter.key === 'property' || filter.key === 'field' || filter.key === 'stat' || filter.key === 'свойство' || filter.key === 'поле' || filter.key === 'стат') {
        const propertyFilter = parsePropertyFilterValue(filter.value);
        if (propertyFilter) filters.properties.push(propertyFilter);
        continue;
      }
    }

    const normalized = normalizeSearchText(token.raw);
    if (!normalized) continue;
    if (token.quoted) {
      phrases.push(normalized);
    } else {
      terms.push(...normalized.split(' ').filter(Boolean));
    }
  }

  return {
    raw: query,
    normalizedFreeText: [...phrases, ...terms].join(' ').trim(),
    terms,
    phrases,
    filters,
  };
}

function stringifyPrimitive(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function collectPropertySearchParts(value: unknown, parts: string[], keyPath: string[] = []): void {
  const primitive = stringifyPrimitive(value);
  if (primitive) {
    parts.push(primitive);
    const lastKey = keyPath[keyPath.length - 1];
    if (lastKey) parts.push(`${lastKey} ${primitive}`);
    if (keyPath.length > 1) parts.push(`${keyPath.join(' ')} ${primitive}`);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectPropertySearchParts(item, parts, keyPath));
    return;
  }

  if (!value || typeof value !== 'object') return;

  Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
    parts.push(key);
    collectPropertySearchParts(child, parts, [...keyPath, key]);
  });
}

function collectPropertySearchEntries(value: unknown, entries: PropertySearchEntry[], keyPath: string[] = []): void {
  const primitive = stringifyPrimitive(value);
  if (primitive) {
    const path = keyPath.join('.');
    const key = keyPath[keyPath.length - 1] ?? '';
    entries.push({
      path,
      key,
      text: primitive,
      normalizedPath: normalizeSearchText(path),
      normalizedKey: normalizeSearchText(key),
      normalizedText: normalizeSearchText(primitive),
      numericValue: typeof value === 'number' ? value : toFiniteNumber(primitive),
    });
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectPropertySearchEntries(item, entries, [...keyPath, String(index)]));
    return;
  }

  if (!value || typeof value !== 'object') return;

  Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
    collectPropertySearchEntries(child, entries, [...keyPath, key]);
  });
}

function propertyPathMatches(entry: PropertySearchEntry, filter: EntitySearchPropertyFilter): boolean {
  if (entry.normalizedKey === filter.normalizedPath || entry.normalizedPath === filter.normalizedPath) return true;

  const pathWords = entry.normalizedPath.split(' ').filter(Boolean);
  const filterWords = filter.normalizedPath.split(' ').filter(Boolean);
  return filterWords.length > 0 && filterWords.every((word) => pathWords.includes(word));
}

function propertyValueMatches(entry: PropertySearchEntry, filter: EntitySearchPropertyFilter): boolean {
  if (filter.operator === ':') return entry.normalizedText.includes(filter.normalizedValue);
  if (filter.operator === '=') {
    if (entry.numericValue != null && filter.numericValue != null) return entry.numericValue === filter.numericValue;
    return entry.normalizedText === filter.normalizedValue;
  }

  if (entry.numericValue == null || filter.numericValue == null) return false;
  if (filter.operator === '>') return entry.numericValue > filter.numericValue;
  if (filter.operator === '>=') return entry.numericValue >= filter.numericValue;
  if (filter.operator === '<') return entry.numericValue < filter.numericValue;
  if (filter.operator === '<=') return entry.numericValue <= filter.numericValue;
  return false;
}

function propertyFilterMatches(entry: PropertySearchEntry, filter: EntitySearchPropertyFilter): boolean {
  return propertyPathMatches(entry, filter) && propertyValueMatches(entry, filter);
}

function buildEntitySearchFields(entity: Entity, resolveTagName?: TagNameResolver): SearchField[] {
  const propertyParts: string[] = [];
  collectPropertySearchParts(entity.properties || {}, propertyParts);

  const tagParts: string[] = [];
  for (const tagId of entity.tags || []) {
    tagParts.push(tagId);
    const tagName = resolveTagName?.(tagId);
    if (tagName) tagParts.push(tagName);
  }

  return [
    { field: 'name', text: entity.name, weight: 12 },
    { field: 'description', text: entity.description || '', weight: 5 },
    { field: 'property', text: propertyParts.join(' '), weight: 7 },
    { field: 'tag', text: tagParts.join(' '), weight: 6 },
    { field: 'type', text: entity.type, weight: 3 },
    { field: 'id', text: entity.id, weight: 2 },
    { field: 'database', text: entity.database || '', weight: 1 },
  ];
}

function getMatchedTerms(fieldText: string, terms: string[]): string[] {
  const normalizedField = normalizeSearchText(fieldText);
  return terms.filter((term) => normalizedField.includes(term));
}

function searchFilterMatches(entity: Entity, parsed: ParsedEntitySearchQuery, fields: SearchField[]): { matches: boolean; matchedFields: EntitySearchMatchField[]; score: number } {
  const matchedFields: EntitySearchMatchField[] = [];
  let score = 0;

  if (parsed.filters.types.length > 0) {
    const entityType = normalizeSearchText(entity.type);
    const typeMatches = parsed.filters.types.some((type) => entityType === type);
    if (!typeMatches) return { matches: false, matchedFields: [], score: 0 };
    matchedFields.push('type');
    score += 8;
  }

  if (parsed.filters.databases.length > 0) {
    const database = normalizeSearchText(entity.database || '');
    const databaseMatches = parsed.filters.databases.some((filter) => database === filter);
    if (!databaseMatches) return { matches: false, matchedFields: [], score: 0 };
    matchedFields.push('database');
    score += 4;
  }

  if (parsed.filters.tags.length > 0) {
    const tagField = fields.find((field) => field.field === 'tag')?.text ?? '';
    const normalizedTags = normalizeSearchText(tagField);
    const tagsMatch = parsed.filters.tags.every((tag) => normalizedTags.includes(tag));
    if (!tagsMatch) return { matches: false, matchedFields: [], score: 0 };
    matchedFields.push('tag');
    score += 6 * parsed.filters.tags.length;
  }

  if (parsed.filters.properties.length > 0) {
    const propertyEntries: PropertySearchEntry[] = [];
    collectPropertySearchEntries(entity.properties || {}, propertyEntries);
    const propertiesMatch = parsed.filters.properties.every((filter) =>
      propertyEntries.some((entry) => propertyFilterMatches(entry, filter))
    );
    if (!propertiesMatch) return { matches: false, matchedFields: [], score: 0 };
    matchedFields.push('property');
    score += 9 * parsed.filters.properties.length;
  }

  return { matches: true, matchedFields, score };
}

function createSnippet(text: string, terms: string[], maxLength = 96): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  const firstIndex = terms
    .map((term) => lower.indexOf(term.toLowerCase()))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0] ?? 0;

  const start = Math.max(0, firstIndex - 28);
  const end = Math.min(trimmed.length, start + maxLength);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < trimmed.length ? '…' : '';
  return `${prefix}${trimmed.slice(start, end)}${suffix}`;
}

export function buildEntitySearchText(entity: Entity, resolveTagName?: TagNameResolver): string {
  return normalizeSearchText(buildEntitySearchFields(entity, resolveTagName).map((field) => field.text).filter(Boolean).join(' '));
}

export function getEntitySearchResult(entity: Entity, query: string, resolveTagName?: TagNameResolver): EntitySearchResult {
  const parsed = parseEntitySearchQuery(query);
  if (!parsed.normalizedFreeText && parsed.filters.types.length === 0 && parsed.filters.tags.length === 0 && parsed.filters.databases.length === 0 && parsed.filters.properties.length === 0) {
    return { matches: true, score: 0, matchedFields: [], matchedTerms: [], snippet: '' };
  }

  const fields = buildEntitySearchFields(entity, resolveTagName);
  const filterResult = searchFilterMatches(entity, parsed, fields);
  if (!filterResult.matches) {
    return { matches: false, score: 0, matchedFields: [], matchedTerms: [], snippet: '' };
  }

  const haystack = normalizeSearchText(fields.map((field) => field.text).join(' '));
  const terms = [...parsed.terms, ...parsed.phrases];
  const hasTextSearch = terms.length > 0;
  const phraseMatches = parsed.normalizedFreeText ? haystack.includes(parsed.normalizedFreeText) : false;
  const matchedTerms = terms.filter((term) => haystack.includes(term));
  const textMatches = !hasTextSearch || phraseMatches || terms.every((term) => matchedTerms.includes(term));
  const matches = filterResult.matches && textMatches;

  if (!matches) {
    return { matches: false, score: 0, matchedFields: [], matchedTerms, snippet: '' };
  }

  const matchedFields: EntitySearchMatchField[] = [...filterResult.matchedFields];
  let score = filterResult.score + (phraseMatches ? 10 : 0);
  let snippet = '';

  for (const field of fields) {
    const fieldTerms = getMatchedTerms(field.text, terms);
    const fieldText = normalizeSearchText(field.text);
    const fieldPhraseMatches = parsed.normalizedFreeText ? fieldText.includes(parsed.normalizedFreeText) : false;
    if (fieldTerms.length === 0 && !fieldPhraseMatches) continue;

    matchedFields.push(field.field);
    score += field.weight * Math.max(1, fieldTerms.length);
    if (field.field === 'name') score += 8;
    if (!snippet && field.field !== 'id' && field.field !== 'database' && field.field !== 'type') {
      snippet = createSnippet(field.text, fieldTerms.length > 0 ? fieldTerms : terms);
    }
  }

  return {
    matches,
    score,
    matchedFields: [...new Set(matchedFields)],
    matchedTerms,
    snippet,
  };
}

export function entityMatchesSearch(entity: Entity, query: string, resolveTagName?: TagNameResolver): boolean {
  return getEntitySearchResult(entity, query, resolveTagName).matches;
}
