(() => {
  const MAX_TILES = 10;

  async function getConfig() {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function activeGames(config) {
    const poll = (config.polls || []).find((item) => item.id === config.activePollId);
    return poll?.games || [];
  }

  function addTile(backdrop, game, index) {
    const tile = document.createElement('div');
    tile.className = `boardgame-bg-tile tile-${index + 1}`;

    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.loading = 'eager';

    const candidates = [game.imageUrl, ...(game.imageFallbackUrls || [])].filter(Boolean);
    let candidateIndex = 0;

    const tryNext = () => {
      if (candidateIndex >= candidates.length) {
        tile.remove();
        return;
      }
      img.src = candidates[candidateIndex++];
    };

    img.addEventListener('error', tryNext);
    tryNext();

    tile.appendChild(img);
    backdrop.appendChild(tile);
  }

  async function start() {
    const backdrop = document.createElement('div');
    backdrop.className = 'boardgame-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.prepend(backdrop);

    try {
      const config = await getConfig();
      const games = activeGames(config).filter((game) => game.imageUrl);
      games.slice(0, MAX_TILES).forEach((game, index) => addTile(backdrop, game, index));
      document.documentElement.classList.add('has-boardgame-collage');
    } catch (error) {
      console.warn('Kunne ikke indlæse brætspilscollage.', error);
      backdrop.remove();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
