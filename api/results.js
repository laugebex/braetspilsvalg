const { json, getPoll, normalizeName, voterKey, parseVotes, resultsForPoll } = require('../lib/shared');
const { command, votesKey } = require('../lib/redis');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const poll = getPoll(req.query.pollId);
    if (!poll) return json(res, 404, { error: 'Afstemningen findes ikke.' });

    const raw = await command(['HGETALL', votesKey(poll.id)]);
    const votes = parseVotes(raw);
    const viewer = normalizeName(req.query.viewer);
    const viewerHasVoted = viewer ? votes.some((v) => voterKey(v.name) === voterKey(viewer)) : false;

    if (poll.status === 'open' && !viewerHasVoted) {
      return json(res, 200, {
        locked: true,
        voterCount: votes.length,
        message: 'Resultatet vises, når du selv har stemt.'
      });
    }
    return json(res, 200, { locked: false, ...resultsForPoll(poll, votes) });
  } catch (error) {
    if (error.code === 'STORAGE_NOT_CONFIGURED') return json(res, 503, { error: 'Datalagringen er ikke koblet på endnu.' });
    console.error(error);
    return json(res, 500, { error: 'Kunne ikke hente resultatet.' });
  }
};
