const assert = require('node:assert');
const {
  getPoll, allowedVoters, canonicalVoter, resultsForPoll, topIds
} = require('./lib/shared');

const poll = getPoll('2026-09');
assert.deepStrictEqual(allowedVoters(poll), ['Martin', 'Carsten', 'Nordbek', 'Peter', 'Lauge']);
assert.strictEqual(canonicalVoter(poll, 'lauge'), 'Lauge');
assert.strictEqual(canonicalVoter(poll, 'Ukendt'), null);

const votes = [
  { name: 'Martin', selections: ['inis'] },
  { name: 'Carsten', selections: ['inis', 'el-grande'] },
  { name: 'Nordbek', selections: ['el-grande'] },
  { name: 'Peter', selections: ['inis'] },
  { name: 'Lauge', selections: ['el-grande'] }
];
const results = resultsForPoll(poll, votes);
assert.deepStrictEqual(topIds(results.games).sort(), ['el-grande', 'inis']);

console.log('tests ok');
