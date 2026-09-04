(() => {
  let pollId = null;
  let timer = null;
  let refreshing = false;

  async function getJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function markButtons(votedNames) {
    const voted = new Set((votedNames || []).map((name) => String(name).toLocaleLowerCase('da-DK')));
    document.querySelectorAll('.voter-option').forEach((button) => {
      const name = button.dataset.name || button.textContent.replace(/\s*✓\s*$/, '').trim();
      button.dataset.name = name;
      const hasVoted = voted.has(name.toLocaleLowerCase('da-DK'));
      button.classList.toggle('has-voted', hasVoted);
      button.textContent = hasVoted ? `${name} ✓` : name;
      button.setAttribute('aria-label', hasVoted ? `${name}, har stemt` : `${name}, har ikke stemt endnu`);
    });
  }

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      if (!pollId) {
        const config = await getJson('/api/config');
        pollId = config.activePollId;
      }
      if (!pollId) return;

      const data = await getJson(`/api/state?pollId=${encodeURIComponent(pollId)}`);
      const voters = data.phase === 'main'
        ? (data.voters || [])
        : ((data.mainComplete && data.poll?.voters) ? data.poll.voters : (data.voters || []));
      markButtons(voters);
    } catch (error) {
      console.warn('Kunne ikke opdatere stemmestatus på navneknapperne.', error);
    } finally {
      refreshing = false;
    }
  }

  function scheduleRefresh() {
    clearTimeout(timer);
    timer = setTimeout(refresh, 60);
  }

  function start() {
    refresh();
    const voterOptions = document.querySelector('#voter-options');
    const progress = document.querySelector('#progress');
    if (voterOptions) new MutationObserver(scheduleRefresh).observe(voterOptions, { childList: true, subtree: true });
    if (progress) new MutationObserver(scheduleRefresh).observe(progress, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
