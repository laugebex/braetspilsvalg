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

async function checkCandidates(game) {
  const candidates = [game.imageUrl, ...(game.imageFallbackUrls || [])].filter(Boolean);
  const checks = [];
  let workingUrl = null;

  for (const url of candidates) {
    const result = await check(url);
    checks.push({ url, ...result });
    if (!workingUrl && result.ok) workingUrl = url;
  }

  return {
    id: game.id,
    name: game.name,
    kind: game.imageKind || '',
    primaryUrl: game.imageUrl || '',
    primaryOk: Boolean(checks[0]?.ok),
    workingUrl,
    usedFallback: Boolean(workingUrl && workingUrl !== game.imageUrl),
    ok: game.imageKind === 'board' && Boolean(workingUrl),
    candidates: checks
  };
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

  const games = await Promise.all((poll.games || []).map(checkCandidates));

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({
    pollId: poll.id,
    ok: games.every((game) => game.ok),
    primaryOk: games.every((game) => game.primaryOk),
    checkedAt: new Date().toISOString(),
    games
  }));
};
