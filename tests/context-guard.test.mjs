import test from 'node:test';
import assert from 'node:assert/strict';
import { admitContext } from '../skill/scripts/context-guard.mjs';
const now = Date.parse('2026-11-08T12:00:00Z');
const sample = (extra = {}) => ({ sessionId: 's', requestId: 'r', measurement: 'runtime', measuredAt: new Date(now).toISOString(), effectiveWindowTokens: 100000, occupiedTokens: 40000, nextInputTokens: 2000, reservedOutputTokens: 4000, reservedToolTokens: 4000, ...extra });
test('reserves generation and tool output; handoff begins at 50%', () => {
 assert.equal(admitContext(sample(), now).action, 'checkpoint_then_handoff');
 assert.equal(admitContext(sample({occupiedTokens: 50000}), now).allowed, true);
 assert.equal(admitContext(sample({occupiedTokens: 50001}), now).allowed, false);
});
test('cache hits do not reduce occupancy', () => {
 const cached=admitContext(sample({occupiedTokens:59000,cachedTokens:59000}),now);
 assert.equal(cached.allowed,false);assert.equal(cached.projectedTokens,69000);
 assert.deepEqual(cached,admitContext(sample({occupiedTokens:59000}),now));
});
test('unknown, stale and invalid telemetry fail closed', () => {
 for (const extra of [{ effectiveWindowTokens: 0 }, { measuredAt: '2026-11-08T11:58:00Z' }, { occupiedTokens: -1 }, { reservedToolTokens: NaN }, { reservedOutputTokens: 0 }, { measurement: 'guess' }, { requestId: '' }]) assert.equal(admitContext(sample(extra), now).allowed, false);
});

test('identities and tool reservations cannot be omitted or mistyped',()=>{
 for(const extra of [{sessionId:1},{requestId:{}},{sessionId:' '},{reservedToolTokens:0}])assert.equal(admitContext(sample(extra),now).allowed,false);
 assert.equal(admitContext(sample({toolsEnabled:false,reservedToolTokens:0}),now).allowed,true);
});
