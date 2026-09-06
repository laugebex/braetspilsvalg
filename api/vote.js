const { json, getPoll, canonicalVoter, voterKey, isSupersededMainVote } = require('../lib/shared');
const { command, votesKey } = require('../lib/redis');
const { loadElection } = require('../lib/election');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const poll = getPoll(body.pollId);
    if (!poll) return json(res, 404, { error: 'Afstemningen findes ikke.' });
    if (poll.status !== 'open') return json(res, 409, { error: 'Afstemningen er lukket.' });

    const name = canonicalVoter(poll, body.name);
    if (!name) return json(res, 400, { error: 'Vælg en af de fem deltagere.' });

    const election = await loadElection(poll);
    if (election.phase !== 'main') return json(res, 409, { error: 'Grundafstemningen er allerede lukket.' });

    const allowed = new Set(poll.games.map((g) => g.id));
    const selections = Array.isArray(body.selections)
      ? [...new Set(body.selections.filter((id) => allowed.has(id)))]
      : [];

    const key = voterKey(name);
    const vote = { name, selections, createdAt: new Date().toISOString() };
    const inserted = await command([
      'HSETNX',
      votesKey(poll.id),
      key,
      JSON.stringify(vote)
    ]);

    if (Number(inserted) !== 1) {
      const rawExisting = await command(['HGET', votesKey(poll.id), key]);
      let existing = null;
      try { existing = typeof rawExisting === 'string' ? JSON.parse(rawExisting) : rawExisting; } catch (_) {}

      if (!existing || !isSupersededMainVote(poll, existing)) {
        return json(res, 409, { error: 'Du har allerede stemt. Din stemme kan ikke ændres.' });
      }

      await command(['HSET', votesKey(poll.id), key, JSON.stringify(vote)]);
    }

    const updated = await loadElection(poll);
    return json(res, 200, { ok: true, phase: updated.phase, complete: updated.complete });
  } catch (error) {
    if (error.code === 'STORAGE_NOT_CONFIGURED') return json(res, 503, { error: 'Datalagringen er ikke koblet på endnu.' });
    console.error(error);
    return json(res, 500, { error: 'Kunne ikke gemme stemmen.' });
  }
};
