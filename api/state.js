const { json, getPoll, canonicalVoter, voterKey, allowedVoters } = require('../lib/shared');
const { loadElection } = require('../lib/election');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const poll = getPoll(req.query.pollId);
    if (!poll) return json(res, 404, { error: 'Afstemningen findes ikke.' });

    const viewer = canonicalVoter(poll, req.query.viewer);
    const election = await loadElection(poll);
    const viewerMainVote = viewer
      ? election.mainVotes.find((v) => voterKey(v.name) === voterKey(viewer)) || null
      : null;

    let viewerTiebreakVote = null;
    if (election.phase === 'tiebreak' && viewer) {
      const activeRound = election.rounds[election.rounds.length - 1];
      const voterGame = activeRound.games.find((g) => g.voters.some((n) => voterKey(n) === voterKey(viewer)));
      if (voterGame) viewerTiebreakVote = voterGame.id;
    }

    return json(res, 200, {
      poll: {
        id: poll.id,
        title: poll.title,
        date: poll.date || null,
        games: poll.games,
        voters: allowedVoters(poll)
      },
      phase: election.phase,
      complete: election.complete,
      voters: election.phase === 'main' ? election.mainResults.voters : (election.voters || election.mainResults.voters),
      missing: election.phase === 'main' ? election.mainResults.missing : (election.missing || []),
      mainComplete: election.mainResults.missing.length === 0,
      mainResults: election.mainResults.missing.length === 0 ? election.mainResults : null,
      winner: election.winner,
      round: election.round || null,
      candidates: election.phase === 'tiebreak'
        ? poll.games.filter((g) => election.candidates.includes(g.id))
        : [],
      viewerMainVote,
      viewerTiebreakVote,
      tiebreakRounds: election.complete ? election.rounds : election.rounds.slice(0, -1)
    });
  } catch (error) {
    if (error.code === 'STORAGE_NOT_CONFIGURED') return json(res, 503, { error: 'Datalagringen er ikke koblet på endnu.' });
    console.error(error);
    return json(res, 500, { error: 'Kunne ikke hente afstemningen.' });
  }
};
