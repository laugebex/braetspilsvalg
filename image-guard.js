(() => {
  const timeoutMs = 7000;

  function checkImage(url) {
    return new Promise((resolve) => {
      if (!url) return resolve(false);
      const img = new Image();
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        img.onload = null;
        img.onerror = null;
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), timeoutMs);
      img.onload = () => finish(img.naturalWidth >= 200 && img.naturalHeight >= 150);
      img.onerror = () => finish(false);
      img.src = url;
    });
  }

  async function runImageCheck() {
    try {
      const response = await fetch('/api/config', { cache: 'no-store' });
      if (!response.ok) return;
      const config = await response.json();
      const poll = config.polls?.find((p) => p.id === config.activePollId);
      if (!poll) return;

      const checks = await Promise.all((poll.games || []).map(async (game) => ({
        id: game.id,
        name: game.name,
        kind: game.imageKind || '',
        url: game.imageUrl || '',
        ok: game.imageKind === 'board' && await checkImage(game.imageUrl)
      })));

      window.__braetspilsvalgImageHealth = checks;
      const broken = checks.filter((item) => !item.ok);
      document.documentElement.dataset.imageHealth = broken.length ? 'warning' : 'ok';

      if (broken.length) {
        console.warn('Brætspilsvalg: billedtjek fandt problemer:', broken.map((x) => x.name));
      } else {
        console.info(`Brætspilsvalg: ${checks.length} spilbilleder kontrolleret OK.`);
      }
    } catch (error) {
      console.warn('Brætspilsvalg: billedtjek kunne ikke gennemføres.', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runImageCheck, { once: true });
  } else {
    runImageCheck();
  }
})();
