const { json, getPoll, canonicalVoter, voterKey } = require('../lib/shared');
const { command, votesKey } = require('../lib/redis');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const poll = getPoll(req.query.pollId);
    const name = poll ? canonicalVoter(poll, req.query.name) : null;
    if (!poll || !name) return json(res, 200, { hasVoted: false });

    const raw = await command(['HGET', votesKey(poll.id), voterKey(name)]);
    return json(res, 200, { hasVoted: Boolean(raw) });
  } catch (error) {
    if (error.code === 'STORAGE_NOT_CONFIGURED') return json(res, 200, { hasVoted: false, storageConfigured: false });
    console.error(error);
    return json(res, 500, { error: 'Kunne ikke hente stemmestatus.' });
  }
};
