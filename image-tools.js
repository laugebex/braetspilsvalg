(() => {
  let gameMap = new Map();

  function gameNameFor(img) {
    if (img.alt) return img.alt.trim();
    const resultName = img.closest('.result-row')?.querySelector('.rank-name span:last-child')?.textContent?.trim();
    return resultName || '';
  }

  function candidatesFor(name) {
    const game = gameMap.get(name);
    if (!game) return [];
    return [game.imageUrl, ...(game.imageFallbackUrls || [])].filter(Boolean);
  }

  function installFallback(img) {
    if (img.dataset.imageToolsReady === '1') return;
    img.dataset.imageToolsReady = '1';
    img.title = 'Klik for at åbne billedet i stor størrelse';

    img.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const url = img.currentSrc || img.src;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  document.addEventListener('error', (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;
    if (!img.matches('.game-cover, .result-cover')) return;

    const name = gameNameFor(img);
    const candidates = candidatesFor(name);
    if (!candidates.length) return;

    const current = img.currentSrc || img.src;
    const index = candidates.findIndex((url) => current === url || img.src === url);
    const next = candidates[index + 1];

    if (next) {
      event.preventDefault();
      event.stopImmediatePropagation();
      img.src = next;
      console.warn(`Brætspilsvalg: skiftede til reservebillede for ${name}.`);
    }
  }, true);

  const observer = new MutationObserver(() => {
    document.querySelectorAll('img.game-cover, img.result-cover').forEach(installFallback);
  });

  async function init() {
    try {
      const response = await fetch('/api/config', { cache: 'no-store' });
      if (response.ok) {
        const config = await response.json();
        const poll = config.polls?.find((p) => p.id === config.activePollId);
        gameMap = new Map((poll?.games || []).map((game) => [game.name, game]));
      }
    } catch (error) {
      console.warn('Brætspilsvalg: kunne ikke indlæse billed-reserver.', error);
    }

    document.querySelectorAll('img.game-cover, img.result-cover').forEach(installFallback);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
