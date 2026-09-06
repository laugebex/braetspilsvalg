const { json, getPoll, voterKey } = require('../lib/shared');
const { command, votesKey } = require('../lib/redis');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const poll = getPoll('2026-09');
    if (!poll) return json(res, 404, { error: 'Afstemningen findes ikke.' });

    const gameId = 'warcraft-the-board-game';
    if (!poll.games.some((game) => game.id === gameId)) {
      return json(res, 409, { error: 'Warcraft er ikke i den aktive afstemning.' });
    }

    const key = voterKey('Carsten');
    const raw = await command(['HGET', votesKey(poll.id), key]);
    if (!raw) return json(res, 404, { error: 'Carsten har ikke afgivet en stemme endnu.' });

    let vote;
    try {
      vote = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (_) {
      return json(res, 500, { error: 'Carstens gemte stemme kunne ikke læses.' });
    }

    const beforeCount = Array.isArray(vote.selections) ? vote.selections.length : 0;
    const selections = new Set(Array.isArray(vote.selections) ? vote.selections : []);
    const alreadyPresent = selections.has(gameId);
    selections.add(gameId);

    if (!alreadyPresent) {
      const updated = {
        ...vote,
        selections: [...selections],
        adjustedAt: new Date().toISOString(),
        adjustment: 'Added WarCraft: The Board Game at voter request'
      };
      await command(['HSET', votesKey(poll.id), key, JSON.stringify(updated)]);
    }

    return json(res, 200, {
      ok: true,
      changed: !alreadyPresent,
      voter: 'Carsten',
      addedGame: 'WarCraft: The Board Game',
      selectionCountBefore: beforeCount,
      selectionCountAfter: beforeCount + (alreadyPresent ? 0 : 1)
    });
  } catch (error) {
    if (error.code === 'STORAGE_NOT_CONFIGURED') return json(res, 503, { error: 'Datalagringen er ikke koblet på.' });
    console.error(error);
    return json(res, 500, { error: 'Kunne ikke opdatere stemmen.' });
  }
};
