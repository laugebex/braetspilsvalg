const { json, getPoll, normalizeName, voterKey } = require('../lib/shared');
const { command, votesKey } = require('../lib/redis');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const poll = getPoll(body.pollId);
    if (!poll) return json(res, 404, { error: 'Afstemningen findes ikke.' });
    if (poll.status !== 'open') return json(res, 409, { error: 'Afstemningen er lukket.' });

    const name = normalizeName(body.name);
    if (name.length < 2) return json(res, 400, { error: 'Skriv dit navn.' });

    const allowed = new Set(poll.games.map((g) => g.id));
    const selections = Array.isArray(body.selections)
      ? [...new Set(body.selections.filter((id) => allowed.has(id)))]
      : [];

    const vote = { name, selections, updatedAt: new Date().toISOString() };
    await command(['HSET', votesKey(poll.id), voterKey(name), JSON.stringify(vote)]);
    return json(res, 200, { ok: true, vote });
  } catch (error) {
    if (error.code === 'STORAGE_NOT_CONFIGURED') {
      return json(res, 503, { error: 'Datalagringen er ikke koblet på endnu.' });
    }
    console.error(error);
    return json(res, 500, { error: 'Kunne ikke gemme stemmen.' });
  }
};
