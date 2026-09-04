const { config, json } = require('../lib/shared');
const { loadElection } = require('../lib/election');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const polls = [];
    for (const poll of config.polls) {
      const election = await loadElection(poll);
      if (election.phase === 'main') {
        polls.push({
          pollId: poll.id, title: poll.title, date: poll.date || null,
          complete: false, voters: election.mainResults.voters, missing: election.mainResults.missing
        });
      } else {
        polls.push({
          pollId: poll.id, title: poll.title, date: poll.date || null,
          complete: election.complete,
          mainResults: election.mainResults,
          tiebreakRounds: election.rounds,
          winner: election.winner
        });
      }
    }
    return json(res, 200, { polls: polls.reverse() });
  } catch (error) {
    if (error.code === 'STORAGE_NOT_CONFIGURED') return json(res, 503, { error: 'Datalagringen er ikke koblet på endnu.' });
    console.error(error);
    return json(res, 500, { error: 'Kunne ikke hente historikken.' });
  }
};
