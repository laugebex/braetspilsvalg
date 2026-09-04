const { config, json, normalizeName, voterKey, parseVotes, resultsForPoll } = require('../lib/shared');
const { command, votesKey } = require('../lib/redis');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const viewer = normalizeName(req.query.viewer);
    const all = [];
    for (const poll of config.polls) {
      const raw = await command(['HGETALL', votesKey(poll.id)]);
      const votes = parseVotes(raw);
      const viewerHasVoted = viewer ? votes.some((v) => voterKey(v.name) === voterKey(viewer)) : false;
      if (poll.status === 'open' && !viewerHasVoted) {
        all.push({ pollId: poll.id, title: poll.title, status: poll.status, locked: true, voterCount: votes.length });
      } else {
        all.push({ ...resultsForPoll(poll, votes), locked: false, votes });
      }
    }
    return json(res, 200, { polls: all.reverse() });
  } catch (error) {
    if (error.code === 'STORAGE_NOT_CONFIGURED') return json(res, 503, { error: 'Datalagringen er ikke koblet på endnu.' });
    console.error(error);
    return json(res, 500, { error: 'Kunne ikke hente historikken.' });
  }
};
