/**
 * entitySerializer.test.ts
 * 
 * Roundtrip tests: Entity → Markdown → Entity
 * Run with: npx tsx app/src/utils/entitySerializer.test.ts
 */

import { serializeEntity, entityToFilename } from './entitySerializer';
import { parseEntityFile, filenameToEntityName } from './entityParser';
import type { Entity } from '../types';

// ─── Test Helpers ───

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
    if (condition) {
        console.log(`  ✅ ${message}`);
        passed++;
    } else {
        console.error(`  ❌ ${message}`);
        failed++;
    }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string) {
    const a = JSON.stringify(actual, null, 2);
    const e = JSON.stringify(expected, null, 2);
    if (a === e) {
        console.log(`  ✅ ${message}`);
        passed++;
    } else {
        console.error(`  ❌ ${message}`);
        console.error(`    Expected: ${e}`);
        console.error(`    Actual:   ${a}`);
        failed++;
    }
}

// ─── Test Entities ───

const noteEntity: Entity = {
    id: 'rules_magic',
    parentId: null,
    type: 'note',
    name: 'Правила Магии',
    description: 'Каждое заклинание требует затраты **маны**.\n\nСмотри также: [[Огненный Шар]].',
    tags: ['магия', 'правила'],
    properties: {},
};

const characterEntity: Entity = {
    id: 'torin',
    parentId: null,
    type: 'character',
    name: 'Торин Железнобокий',
    description: 'Ветеран северных войн, мастер двуручного меча.',
    tags: ['игрок', 'воин'],
    imageId: 'warrior.png',
    properties: {
        strength: { base: 18 },
        dexterity: { base: 14 },
        constitution: { base: 16 },
        hp: { max: '8 + $constitution', current: 32 },
    },
};

const objectEntity: Entity = {
    id: 'excalibur',
    parentId: null,
    type: 'object',
    name: 'Экскалибур',
    description: 'Легендарный меч, выкованный в горниле [[Гора Судьбы]].',
    tags: ['оружие', 'магическое'],
    imageId: 'excalibur.png',
    properties: {
        damage: '2d6 + 4',
        weight: 6,
        rarity: 'legendary',
    },
};

const tagEntity: Entity = {
    id: 'poisoned',
    parentId: null,
    type: 'tag',
    name: 'Отравлен',
    description: 'Существо получает штраф к ловкости и AC.',
    tags: [],
    properties: {
        category: 'status',
        modifiers: [
            { stat: 'dexterity', op: 'add', value: -4 },
            { stat: 'ac', op: 'add', value: -2 },
        ],
        duration: '3 раунда',
        icon: '🤢',
    },
};

const abilityEntity: Entity = {
    id: 'fireball',
    parentId: null,
    type: 'ability',
    name: 'Огненный Шар',
    description: 'Вы создаёте яркую полосу пламени.',
    tags: ['магия', 'огонь'],
    properties: {
        cost: { mana: 6, action: 1 },
        range: '150 ft',
        area: '20ft radius sphere',
        dice: '8d6',
    },
};

const canvasEntity: Entity = {
    id: 'tavern',
    parentId: null,
    type: 'canvas',
    name: 'Таверна',
    description: 'Шумное заведение в центре города.',
    tags: [],
    imageId: 'tavern_map.jpg',
    properties: {
        grid: { size: 40, snap: true },
        tokens: [
            { entity: 'Торин Железнобокий', x: 320, y: 480 },
        ],
    },
};

// ─── Tests ───

console.log('\n🧪 Entity Serializer/Parser Tests\n');

// Test 1: Note roundtrip
console.log('📝 Test 1: Note roundtrip');
{
    const md = serializeEntity(noteEntity);
    assert(md.includes('---'), 'Has frontmatter delimiters');
    assert(md.includes('type: note'), 'Has type in frontmatter');
    assert(md.includes('# Правила Магии'), 'Has title');
    assert(md.includes('[[Огненный Шар]]'), 'Preserves wiki-links');

    const { entity } = parseEntityFile(md, 'Правила Магии');
    assert(entity.type === 'note', 'Parsed type is note');
    assert(entity.name === 'Правила Магии', 'Parsed name matches');
    assertDeepEqual(entity.tags, ['магия', 'правила'], 'Tags preserved');
    assert(entity.description.includes('[[Огненный Шар]]'), 'Description preserved');
}

// Test 2: Character roundtrip
console.log('\n⚔️ Test 2: Character roundtrip');
{
    const md = serializeEntity(characterEntity);
    assert(md.includes('type: character'), 'Has character type');
    assert(md.includes('image: warrior.png'), 'Has image');
    assert(md.includes('strength: 18'), 'Stats serialized correctly');
    assert(md.includes('# Торин Железнобокий'), 'Has title');

    const { entity } = parseEntityFile(md, 'Торин Железнобокий');
    assert(entity.type === 'character', 'Parsed type is character');
    assert(entity.name === 'Торин Железнобокий', 'Parsed name matches');
    assert(entity.imageId === 'warrior.png', 'Image preserved');
    assert((entity.properties.strength as any)?.base === 18, 'Strength stat preserved');
    assert((entity.properties.dexterity as any)?.base === 14, 'Dexterity stat preserved');
    assert((entity.properties.hp as any)?.current === 32, 'HP current preserved');
}

// Test 3: Object roundtrip
console.log('\n🗡️ Test 3: Object roundtrip');
{
    const md = serializeEntity(objectEntity);
    assert(md.includes('type: object'), 'Has object type');
    assert(md.includes('[[Гора Судьбы]]'), 'Wiki-links in description preserved');

    const { entity } = parseEntityFile(md, 'Экскалибур');
    assert(entity.type === 'object', 'Parsed type is object');
    assert(entity.name === 'Экскалибур', 'Parsed name matches');
    assert(entity.properties.damage === '2d6 + 4', 'Damage preserved');
    assert(entity.properties.weight === 6, 'Weight preserved');
}

// Test 4: Tag with modifiers roundtrip
console.log('\n🏷️ Test 4: Tag roundtrip');
{
    const md = serializeEntity(tagEntity);
    assert(md.includes('type: tag'), 'Has tag type');
    assert(md.includes('category: status'), 'Category in frontmatter');

    const { entity } = parseEntityFile(md, 'Отравлен');
    assert(entity.type === 'tag', 'Parsed type is tag');
    assert(entity.properties.category === 'status', 'Category preserved');
    assert(Array.isArray(entity.properties.modifiers), 'Modifiers is array');
    const mod = (entity.properties.modifiers as any[])[0];
    assert(mod?.stat === 'dexterity', 'First modifier stat preserved');
    assert(mod?.value === -4, 'First modifier value preserved');
}

// Test 5: Ability roundtrip
console.log('\n✨ Test 5: Ability roundtrip');
{
    const md = serializeEntity(abilityEntity);
    assert(md.includes('type: ability'), 'Has ability type');
    assert(md.includes('dice: 8d6'), 'Dice in frontmatter');

    const { entity } = parseEntityFile(md, 'Огненный Шар');
    assert(entity.type === 'ability', 'Parsed type is ability');
    assert(entity.properties.dice === '8d6', 'Dice preserved');
    assert((entity.properties.cost as any)?.mana === 6, 'Cost mana preserved');
}

// Test 6: Canvas roundtrip
console.log('\n🗺️ Test 6: Canvas roundtrip');
{
    const md = serializeEntity(canvasEntity);
    assert(md.includes('type: canvas'), 'Has canvas type');

    const { entity } = parseEntityFile(md, 'Таверна');
    assert(entity.type === 'canvas', 'Parsed type is canvas');
    assert((entity.properties.grid as any)?.size === 40, 'Grid size preserved');
    assert(Array.isArray(entity.properties.tokens), 'Tokens is array');
}

// Test 7: Filename generation
console.log('\n📁 Test 7: Filename utilities');
{
    assert(entityToFilename(noteEntity) === 'Правила Магии.md', 'Note filename');
    assert(entityToFilename(characterEntity) === 'Торин Железнобокий.md', 'Character filename');
    assert(filenameToEntityName('Экскалибур.md') === 'Экскалибур', 'Filename → name');
    assert(filenameToEntityName('Зелье (2).md') === 'Зелье (2)', 'Filename with suffix → name');
}

// Test 8: User DB with uid
console.log('\n👤 Test 8: User DB serialization (with uid)');
{
    const md = serializeEntity(objectEntity, { includeUid: true, source: 'Экскалибур' });
    assert(md.includes('uid: excalibur'), 'Has uid in frontmatter');
    assert(md.includes('source: Экскалибур'), 'Has source in frontmatter');

    const { entity } = parseEntityFile(md, 'fallback');
    assert(entity.id === 'excalibur', 'Parsed uid as id');
}

// Test 9: Plain markdown without frontmatter
console.log('\n📄 Test 9: Plain .md file (no frontmatter)');
{
    const plainMd = '# My Note\n\nThis is just a plain markdown file.';
    const { entity } = parseEntityFile(plainMd, 'My Note');
    assert(entity.type === 'note', 'Defaults to note type');
    assert(entity.name === 'My Note', 'Extracts title');
    assert(entity.description === 'This is just a plain markdown file.', 'Extracts body');
}

// ─── Results ───
console.log(`\n${'═'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(40)}\n`);

if (failed > 0) {
    process.exit(1);
}
