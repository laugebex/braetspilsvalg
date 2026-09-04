const { config } = require('../lib/shared');

function decodeXml(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"');
}

function send(res, images, cache = true) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache ? 'public, s-maxage=86400, stale-while-revalidate=604800' : 'no-store');
  res.end(JSON.stringify({ images }));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('Method not allowed');
  }
  try {
    const ids = [...new Set(config.polls.flatMap((p) => p.games.map((g) => g.bggId).filter(Boolean)))];
    if (!ids.length) return send(res, {});

    const response = await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${ids.join(',')}`, {
      headers: { 'User-Agent': 'braetspilsvalg/1.0 personal-boardgame-voting-app' }
    });
    if (!response.ok) throw new Error(`BGG ${response.status}`);
    const xml = await response.text();
    const images = {};

    for (const part of xml.split(/<item\b/).slice(1)) {
      const id = part.match(/\bid="(\d+)"/)?.[1];
      const image = part.match(/<image>([\s\S]*?)<\/image>/)?.[1]
        || part.match(/<thumbnail>([\s\S]*?)<\/thumbnail>/)?.[1];
      if (id && image) images[id] = decodeXml(image.trim());
    }

    return send(res, images);
  } catch (error) {
    console.error(error);
    return send(res, {}, false);
  }
};
