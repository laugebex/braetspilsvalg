const { json, getPoll, canonicalVoter, voterKey } = require('../lib/shared');
const { command, votesKey } = require('../lib/redis');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const poll = getPoll(req.query.pollId);
    const name = poll ? canonicalVoter(poll, req.query.name) : null;
    if (!poll || !name) return json(res, 200, { vote: null });
    const raw = await command(['HGET', votesKey(poll.id), voterKey(name)]);
    if (!raw) return json(res, 200, { vote: null });
    return json(res, 200, { vote: typeof raw === 'string' ? JSON.parse(raw) : raw });
  } catch (error) {
    if (error.code === 'STORAGE_NOT_CONFIGURED') return json(res, 200, { vote: null, storageConfigured: false });
    console.error(error);
    return json(res, 500, { error: 'Kunne ikke hente stemmen.' });
  }
};
