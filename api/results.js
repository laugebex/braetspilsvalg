const { json, getPoll } = require('../lib/shared');
const { loadElection } = require('../lib/election');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const poll = getPoll(req.query.pollId);
    if (!poll) return json(res, 404, { error: 'Afstemningen findes ikke.' });

    const election = await loadElection(poll);
    if (election.phase === 'main') {
      return json(res, 200, {
        locked: true,
        title: poll.title,
        date: poll.date || null,
        voters: election.mainResults.voters,
        missing: election.mainResults.missing,
        voterCount: election.mainResults.voterCount,
        totalVoters: election.mainResults.voterCount + election.mainResults.missing.length,
        message: 'Resultatet vises, når alle fem har stemt.'
      });
    }

    return json(res, 200, {
      locked: false,
      title: poll.title,
      date: poll.date || null,
      phase: election.phase,
      mainResults: election.mainResults,
      tiebreakRounds: election.phase === 'tiebreak' ? election.rounds.slice(0, -1) : election.rounds,
      activeRound: election.phase === 'tiebreak' ? election.round : null,
      activeCandidates: election.phase === 'tiebreak'
        ? poll.games.filter((g) => election.candidates.includes(g.id))
        : [],
      activeVoters: election.phase === 'tiebreak' ? election.voters : [],
      activeMissing: election.phase === 'tiebreak' ? election.missing : [],
      winner: election.winner
    });
  } catch (error) {
    if (error.code === 'STORAGE_NOT_CONFIGURED') return json(res, 503, { error: 'Datalagringen er ikke koblet på endnu.' });
    console.error(error);
    return json(res, 500, { error: 'Kunne ikke hente resultatet.' });
  }
};
