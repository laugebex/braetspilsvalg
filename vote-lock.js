(() => {
  function replaceSubmittedVoteWithReceipt() {
    const content = document.querySelector('#vote-content');
    if (!content) return;

    const updateButton = [...content.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Opdater mine stemmer');

    if (!updateButton) return;

    content.innerHTML = `
      <div class="card success-card" style="text-align:center; padding:28px 20px">
        <div aria-hidden="true" style="font-size:40px; line-height:1; font-weight:900; margin-bottom:10px">✓</div>
        <div class="winner">Stemmen er afgivet</div>
        <p class="help" style="margin-bottom:0">Din stemme er gemt og kan ikke ændres.</p>
      </div>
    `;
  }

  function start() {
    const content = document.querySelector('#vote-content');
    if (!content) return;

    replaceSubmittedVoteWithReceipt();
    new MutationObserver(replaceSubmittedVoteWithReceipt)
      .observe(content, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
