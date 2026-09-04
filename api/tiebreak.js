const { json, getPoll, canonicalVoter, voterKey } = require('../lib/shared');
const { command, tiebreakVotesKey } = require('../lib/redis');
const { loadElection } = require('../lib/election');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const poll = getPoll(body.pollId);
    if (!poll) return json(res, 404, { error: 'Afstemningen findes ikke.' });

    const name = canonicalVoter(poll, body.name);
    if (!name) return json(res, 400, { error: 'Vælg en af de fem deltagere.' });

    const election = await loadElection(poll);
    if (election.phase !== 'tiebreak') return json(res, 409, { error: 'Der er ingen aktiv omstemning.' });
    if (Number(body.round) !== election.round) return json(res, 409, { error: 'Omstemningen har ændret sig. Genindlæs siden.' });
    if (!election.candidates.includes(body.gameId)) return json(res, 400, { error: 'Det spil er ikke med i omstemningen.' });

    const vote = { name, selections: [body.gameId], updatedAt: new Date().toISOString() };
    await command(['HSET', tiebreakVotesKey(poll.id, election.round), voterKey(name), JSON.stringify(vote)]);
    const updated = await loadElection(poll);
    return json(res, 200, { ok: true, phase: updated.phase, complete: updated.complete, winner: updated.winner });
  } catch (error) {
    if (error.code === 'STORAGE_NOT_CONFIGURED') return json(res, 503, { error: 'Datalagringen er ikke koblet på endnu.' });
    console.error(error);
    return json(res, 500, { error: 'Kunne ikke gemme omstemningen.' });
  }
};
