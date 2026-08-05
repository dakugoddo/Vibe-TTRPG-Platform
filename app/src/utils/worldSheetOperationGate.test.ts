import assert from 'node:assert/strict';
import { createWorldSheetOperationGate } from './worldSheetOperationGate';

const gate = createWorldSheetOperationGate();
gate.activateScope('world-a');

const loadA = gate.begin('load');
let runtimeRequestGeneration = 0;
runtimeRequestGeneration += 1; // mutation start invalidation
const mutationA = gate.begin('mutation');
const pollStartedDuringMutation = runtimeRequestGeneration;
assert.equal(gate.isCurrent(loadA), true);
assert.equal(gate.isCurrent(mutationA), true, 'management load and mutation must not supersede each other');

const newerLoadA = gate.begin('load');
assert.equal(gate.isCurrent(loadA), false, 'newer load must supersede older load');
assert.equal(gate.isCurrent(newerLoadA), true);
assert.equal(gate.isCurrent(mutationA), true, 'newer load must not suppress mutation completion');
gate.invalidate('load');
assert.equal(gate.isCurrent(newerLoadA), false, 'mutation start must synchronously invalidate a pending management load');
assert.equal(gate.isCurrent(mutationA), true, 'invalidating load must not invalidate mutation ownership');
if (gate.isScopeCurrent(mutationA)) runtimeRequestGeneration += 1; // mutation completion invalidation
assert.notEqual(pollStartedDuringMutation, runtimeRequestGeneration, 'poll that read old state during mutation must be rejected after completion');

const newerMutationA = gate.begin('mutation');
assert.equal(gate.isCurrent(mutationA), false, 'newer mutation must supersede older mutation UI ownership');
assert.equal(gate.isScopeCurrent(mutationA), true, 'older same-world mutation must still perform completion invalidation');
assert.equal(gate.isCurrent(newerMutationA), true);

const importA = gate.begin('import');
gate.invalidate('import'); // newer oversized/type-rejected selection
assert.equal(gate.isCurrent(importA), false, 'locally rejected import must supersede an older File.text completion');
const acceptedImportA = gate.begin('import');
const confirmA = gate.begin('confirm');
assert.equal(gate.isCurrent(acceptedImportA), true);
assert.equal(gate.isCurrent(confirmA), true);

gate.activateScope('world-b');
for (const operation of [newerLoadA, mutationA, newerMutationA, importA, acceptedImportA, confirmA]) {
    assert.equal(gate.isScopeCurrent(operation), false, 'world A completion must be stale after committed world B activation');
    assert.equal(gate.isCurrent(operation), false);
}

const mutationB = gate.begin('mutation');
assert.equal(gate.isCurrent(mutationB), true);
gate.deactivate();
assert.equal(gate.isScopeCurrent(mutationB), false, 'unmounted settings must reject pending completions');

gate.activateScope('world-b');
const remountedMutationB = gate.begin('mutation');
assert.equal(gate.isCurrent(remountedMutationB), true);
assert.equal(gate.isCurrent(mutationB), false, 'remount must not revive an old completion');

console.log('world sheet operation gate tests passed');
