const { config } = require('../lib/shared');

async function check(url) {
  if (!url) return { ok: false, status: 0, type: '' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'braetspilsvalg/1.0 image-health-check',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Range': 'bytes=0-2047'
      }
    });
    const type = response.headers.get('content-type') || '';
    try { await response.body?.cancel(); } catch (_) {}
    return { ok: response.ok && type.toLowerCase().startsWith('image/'), status: response.status, type };
  } catch (_) {
    return { ok: false, status: 0, type: '' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('Method not allowed');
  }

  const pollId = req.query?.pollId || config.activePollId;
  const poll = config.polls.find((p) => p.id === pollId);
  if (!poll) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Afstemningen findes ikke.' }));
  }

  const games = await Promise.all((poll.games || []).map(async (game) => {
    const result = await check(game.imageUrl);
    return {
      id: game.id,
      name: game.name,
      kind: game.imageKind || '',
      url: game.imageUrl || '',
      ok: game.imageKind === 'board' && result.ok,
      status: result.status,
      type: result.type
    };
  }));

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
  res.end(JSON.stringify({
    pollId: poll.id,
    ok: games.every((game) => game.ok),
    checkedAt: new Date().toISOString(),
    games
  }));
};
