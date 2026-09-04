(() => {
  function lockSubmittedVote() {
    const content = document.querySelector('#vote-content');
    if (!content) return;

    const updateButton = [...content.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Opdater mine stemmer');

    if (!updateButton) return;

    content.querySelectorAll('.game input[type="checkbox"]').forEach((input) => {
      input.disabled = true;
    });

    content.querySelectorAll('.game').forEach((game) => {
      game.classList.add('vote-locked');
      game.setAttribute('aria-disabled', 'true');
    });

    const help = content.querySelector('.card .help');
    if (help) help.textContent = 'Din stemme er afgivet og kan ikke ændres.';

    const sticky = content.querySelector('.sticky-action');
    if (sticky) {
      sticky.innerHTML = '<strong class="status">Din stemme er gemt og låst.</strong>';
    }
  }

  function start() {
    const content = document.querySelector('#vote-content');
    if (!content) return;
    lockSubmittedVote();
    new MutationObserver(lockSubmittedVote).observe(content, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
