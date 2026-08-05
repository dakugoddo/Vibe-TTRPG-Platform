import assert from 'node:assert/strict';
import { isTrustedWorldSheetCapabilityRequest, isTrustedWorldSheetMutationRequest } from './worldSheetRequestSecurity.js';

assert.equal(isTrustedWorldSheetMutationRequest({ remoteAddress: '127.0.0.1' }), true);
assert.equal(isTrustedWorldSheetMutationRequest({ remoteAddress: '::1', origin: 'http://localhost:5173' }), true);
assert.equal(isTrustedWorldSheetMutationRequest({ remoteAddress: '::ffff:127.0.0.1', origin: 'http://127.0.0.1:5173' }), true);
assert.equal(isTrustedWorldSheetMutationRequest({ remoteAddress: '127.0.0.1', origin: 'null', userAgent: 'Mozilla/5.0 Electron/39.2.7' }), true);
assert.equal(isTrustedWorldSheetMutationRequest({ remoteAddress: '127.0.0.1', origin: 'file://', userAgent: 'Mozilla/5.0 Electron/39.2.7' }), true);
assert.equal(isTrustedWorldSheetMutationRequest({ remoteAddress: '192.168.1.10', origin: 'http://localhost:5173' }), false);
assert.equal(isTrustedWorldSheetMutationRequest({ remoteAddress: '127.0.0.1', origin: 'https://attacker.example' }), false);
assert.equal(isTrustedWorldSheetMutationRequest({ remoteAddress: '127.0.0.1', origin: 'null', userAgent: 'Mozilla/5.0 Chrome/126.0.0.0' }), false);

assert.equal(isTrustedWorldSheetCapabilityRequest({ remoteAddress: '127.0.0.1' }), false);
assert.equal(isTrustedWorldSheetCapabilityRequest({ remoteAddress: '127.0.0.1', origin: 'http://127.0.0.1:5173' }), true);
assert.equal(isTrustedWorldSheetCapabilityRequest({ remoteAddress: '::1', origin: 'null', userAgent: 'Mozilla/5.0 Electron/35.0.0' }), true);
assert.equal(isTrustedWorldSheetCapabilityRequest({ remoteAddress: '127.0.0.1', origin: 'https://attacker.example' }), false);
assert.equal(isTrustedWorldSheetCapabilityRequest({ remoteAddress: '192.168.1.5', origin: 'http://127.0.0.1:5173' }), false);

console.log('world sheet request security tests passed');