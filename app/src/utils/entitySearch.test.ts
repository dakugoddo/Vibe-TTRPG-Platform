import { strict as assert } from 'node:assert';
import { entityMatchesSearch, buildEntitySearchText, getEntitySearchResult, getEntitySearchTerms, parseEntitySearchQuery, addRecentEntitySearchQuery, addSavedEntitySearchQuery, removeSavedEntitySearchQuery } from './entitySearch';
import type { Entity } from '../types';

function entity(partial: Partial<Entity>): Entity {
  return {
    id: partial.id || '20260522120000000',
    name: partial.name || 'Кошка',
    type: partial.type || 'character',
    parentId: partial.parentId ?? null,
    description: partial.description || '',
    tags: partial.tags || [],
    properties: partial.properties || {},
    database: partial.database || 'general',
  };
}

const cat = entity({
  name: 'Кошка',
  description: 'Пилот меха разведки.',
  tags: ['tag_fast'],
  properties: {
    skills: {
      атлетика: 3,
      скрытность: { base: 2 },
    },
    hp: { current: 7, max: 10 },
  },
});

assert(entityMatchesSearch(cat, 'кошка'), 'matches name');
assert(entityMatchesSearch(cat, 'пилот меха'), 'matches description tokens');
assert(entityMatchesSearch(cat, 'атлетика 3'), 'matches key + primitive number');
assert(entityMatchesSearch(cat, 'скрытность 2'), 'matches key + nested base value');
assert(entityMatchesSearch(cat, 'быстрый', tagId => tagId === 'tag_fast' ? 'Быстрый' : undefined), 'matches resolved tag name');
assert(!entityMatchesSearch(cat, 'атлетика 9'), 'does not match absent value');

const text = buildEntitySearchText(cat);
assert(text.includes('hp current 7'), 'includes nested property path and value');

const skillResult = getEntitySearchResult(cat, 'атлетика 3');
assert.equal(skillResult.matches, true);
assert(skillResult.score > 0, 'result has a score');
assert(skillResult.matchedFields.includes('property'), 'result reports property match');
assert(skillResult.snippet.includes('атлетика'), 'result includes useful snippet');

const nameResult = getEntitySearchResult(cat, 'кошка');
assert(nameResult.matchedFields.includes('name'), 'result reports name match');
assert(nameResult.score > skillResult.score || nameResult.score > 0, 'name result is scored');

assert.deepEqual(getEntitySearchTerms('  Атлетика: 3! '), ['атлетика', '3']);

const scout = entity({
  id: '20260522120100000',
  name: 'Mecha Scout',
  type: 'character',
  description: 'Fast recon pilot with a silent engine.',
  tags: ['tag_fast'],
  database: 'gm',
  properties: {
    skills: {
      athletics: 3,
      stealth: { base: 2 },
    },
  },
});

assert(entityMatchesSearch(scout, 'type:character stealth 2'), 'matches type filter plus free terms');
assert(entityMatchesSearch(scout, 'тип:персонаж "silent engine"'), 'matches localized type filter plus quoted phrase');
assert(entityMatchesSearch(scout, 'tag:fast', tagId => tagId === 'tag_fast' ? 'Fast' : undefined), 'matches tag filter through resolved tag name');
assert(entityMatchesSearch(scout, '#fast', tagId => tagId === 'tag_fast' ? 'Fast' : undefined), 'matches hash tag shorthand');
assert(entityMatchesSearch(scout, 'db:gm recon'), 'matches database filter plus description');
assert(entityMatchesSearch(scout, 'prop:athletics>=3'), 'matches property numeric comparison filter');
assert(entityMatchesSearch(scout, 'prop:skills.stealth.base=2'), 'matches nested property exact numeric filter');
assert(entityMatchesSearch(cat, 'prop:hp.current<=7'), 'matches dotted nested property comparison');
assert(entityMatchesSearch(cat, 'свойство:атлетика=3'), 'matches localized property filter key');
assert(!entityMatchesSearch(scout, 'type:object stealth 2'), 'rejects wrong type filter');
assert(!entityMatchesSearch(scout, 'db:general recon'), 'rejects wrong database filter');
assert(!entityMatchesSearch(scout, 'prop:athletics>3'), 'rejects failed property numeric comparison filter');

const parsed = parseEntitySearchQuery('type:character tag:fast "silent engine" stealth');
assert.deepEqual(parsed.filters.types, ['character']);
assert.deepEqual(parsed.filters.tags, ['fast']);
assert.deepEqual(parsed.phrases, ['silent engine']);
assert.deepEqual(parsed.terms, ['stealth']);
assert.deepEqual(getEntitySearchTerms('type:character "silent engine" stealth'), ['silent engine', 'stealth']);

const parsedProperty = parseEntitySearchQuery('type:character prop:hp.current<=7 stealth');
assert.deepEqual(parsedProperty.filters.properties.map(filter => [filter.path, filter.operator, filter.value]), [['hp.current', '<=', '7']]);
assert.deepEqual(getEntitySearchTerms('type:character prop:hp.current<=7 stealth'), ['stealth']);

assert.deepEqual(addRecentEntitySearchQuery([], '  type:character   stealth  '), ['type:character stealth']);
assert.deepEqual(
  addRecentEntitySearchQuery(['tag:fast', 'db:gm'], 'TAG:FAST'),
  ['TAG:FAST', 'db:gm']
);
assert.deepEqual(addRecentEntitySearchQuery(['a', 'b'], 'c', 2), ['c', 'a']);
assert.deepEqual(addSavedEntitySearchQuery([], '  db:gm   recon  '), ['db:gm recon']);
assert.deepEqual(addSavedEntitySearchQuery(['type:character', 'tag:fast'], 'TYPE:CHARACTER'), ['TYPE:CHARACTER', 'tag:fast']);
assert.deepEqual(removeSavedEntitySearchQuery(['type:character', 'tag:fast'], 'TYPE:CHARACTER'), ['tag:fast']);

console.log('ok - entity search matches text, tags, structured properties and result metadata');
