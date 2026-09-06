const state = {
  config: null,
  poll: null,
  name: localStorage.getItem('bg-voter-name') || '',
  selections: new Set(),
  tiebreakChoice: null,
  election: null,
  images: {}
};

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function api(path, options) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Der opstod en fejl.');
  return data;
}

function setTab(id) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active-panel', p.id === id));
  if (id === 'results') loadResults();
  if (id === 'history') loadHistory();
}

document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

function formatDate(value) {
  if (!value) return 'Spilledato: ikke sat endnu';
  const date = new Date(`${value}T12:00:00`);
  return `Spilledato: ${new Intl.DateTimeFormat('da-DK', { weekday:'long', day:'numeric', month:'long', year:'numeric' }).format(date)}`;
}

function imageUrl(game) {
  if (game?.imageUrl) return game.imageUrl;
  return game?.bggId ? state.images[String(game.bggId)] || '' : '';
}

function coverHtml(game, cls = 'game-cover') {
  const url = imageUrl(game);
  if (!url) return `<div class="cover-fallback">${esc(game.name)}</div>`;
  return `<img class="${cls}" src="${esc(url)}" alt="${esc(game.name)}" loading="lazy" onerror="this.outerHTML='<div class=&quot;cover-fallback&quot;>Billede</div>'">`;
}

function renderVoterOptions() {
  $('#voter-options').innerHTML = state.config.voters.map(name =>
    `<button type="button" class="voter-option ${state.name === name ? 'selected' : ''}" data-name="${esc(name)}">${esc(name)}</button>`
  ).join('');

  document.querySelectorAll('.voter-option').forEach(btn => btn.addEventListener('click', async () => {
    state.name = btn.dataset.name;
    localStorage.setItem('bg-voter-name', state.name);
    renderVoterOptions();
    updateBadge();
    await loadState();
  }));
}

function updateBadge() {
  const badge = $('#voter-badge');
  if (state.name) {
    badge.textContent = state.name;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function renderProgress(data) {
  const voters = data.voters || [];
  const missing = data.missing || [];
  const total = voters.length + missing.length;
  $('#progress').innerHTML = `<div class="progress-card"><strong>${voters.length}/${total} har stemt.</strong> ${
    missing.length ? `Mangler: ${esc(missing.join(', '))}.` : 'Alle har stemt.'
  }</div>`;
}

function voteReceipt(title = 'Stemmen er afgivet', text = 'Din stemme er gemt og kan ikke ændres.') {
  return `
    <div class="card success-card vote-receipt">
      <div class="receipt-check" aria-hidden="true">✓</div>
      <div class="winner">${esc(title)}</div>
      <p class="help">${esc(text)}</p>
    </div>`;
}

function selectedMarker() {
  return '<span class="selection-check" aria-hidden="true">✓</span>';
}

function updateSaveVoteLabel() {
  const button = $('#save-vote');
  if (!button) return;
  const count = state.selections.size;
  button.textContent = `Gem ${count} ${count === 1 ? 'stemme' : 'stemmer'}`;
}

function renderMainVote(data) {
  state.selections = new Set();

  if (data.viewerHasMainVote) {
    $('#vote-content').innerHTML = voteReceipt();
    return;
  }

  const games = state.poll.games.map(game => `
    <label class="game">
      <div class="cover-wrap">${coverHtml(game)}</div>
      <div class="game-copy">
        <div class="game-name">${esc(game.name)}</div>
        <div class="game-note">${esc(game.note || 'Jeg vil gerne spille dette')}</div>
      </div>
      ${selectedMarker()}
      <input type="checkbox" value="${esc(game.id)}" aria-label="Stem på ${esc(game.name)}">
    </label>
  `).join('');

  $('#vote-content').innerHTML = `
    <div class="card" style="margin-bottom:10px">
      <strong>Stem på alle de spil, du gerne vil spille.</strong>
      <p class="help">Din stemme kan ikke ændres, når den er gemt. Resultatet er skjult, indtil alle fem har stemt.</p>
    </div>
    <div class="games">${games}</div>
    <div class="sticky-action">
      <button id="save-vote" class="primary" ${state.name ? '' : 'disabled'}>Gem 0 stemmer</button>
      <span id="save-status" class="status">${state.name ? '' : 'Vælg dit navn først.'}</span>
    </div>
  `;

  document.querySelectorAll('.game input[type="checkbox"]').forEach(input => input.addEventListener('change', () => {
    if (input.checked) state.selections.add(input.value); else state.selections.delete(input.value);
    input.closest('.game').classList.toggle('selected', input.checked);
    updateSaveVoteLabel();
  }));

  updateSaveVoteLabel();
  $('#save-vote')?.addEventListener('click', saveMainVote);
}

async function saveMainVote() {
  if (!state.name) return;
  const button = $('#save-vote');
  button.disabled = true;
  $('#save-status').textContent = 'Gemmer…';
  try {
    await api('/api/vote', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ pollId: state.poll.id, name: state.name, selections: [...state.selections] })
    });
    $('#save-status').textContent = 'Gemt ✓';
    await loadState();
  } catch (e) {
    $('#save-status').textContent = e.message;
    if ($('#save-vote')) $('#save-vote').disabled = false;
  }
}

function renderTiebreak(data) {
  state.tiebreakChoice = null;

  if (data.viewerHasTiebreakVote) {
    $('#vote-content').innerHTML = voteReceipt('Omstemmen er afgivet', 'Din stemme i denne omstemning er gemt og kan ikke ændres.');
    return;
  }

  const cards = data.candidates.map(game => `
    <label class="game">
      <div class="cover-wrap">${coverHtml(game)}</div>
      <div class="game-copy">
        <div class="game-name">${esc(game.name)}</div>
        <div class="game-note">${esc(game.note || 'Vælg dette spil i omstemningen')}</div>
      </div>
      ${selectedMarker()}
      <input type="radio" name="tiebreak" value="${esc(game.id)}" aria-label="Vælg ${esc(game.name)}">
    </label>
  `).join('');

  $('#vote-content').innerHTML = `
    <div class="card tiebreak-card">
      <p class="eyebrow">Omstemning · runde ${data.round}</p>
      <h2 class="tiebreak-heading">Der er lighed om førstepladsen</h2>
      <p class="help">Vælg præcis ét af de førende spil. Stemmen kan ikke ændres, når den er gemt.</p>
    </div>
    <div class="games">${cards}</div>
    <div class="sticky-action">
      <button id="save-tiebreak" class="primary" disabled>Gem min omstemme</button>
      <span id="tie-status" class="status">${state.name ? '' : 'Vælg dit navn først.'}</span>
    </div>
  `;

  document.querySelectorAll('input[name="tiebreak"]').forEach(input => input.addEventListener('change', () => {
    state.tiebreakChoice = input.value;
    document.querySelectorAll('#vote-content .game').forEach(g => g.classList.remove('selected'));
    input.closest('.game').classList.add('selected');
    $('#save-tiebreak').disabled = !state.name || !state.tiebreakChoice;
  }));

  $('#save-tiebreak')?.addEventListener('click', saveTiebreak);
}

async function saveTiebreak() {
  if (!state.name || !state.tiebreakChoice) return;
  const button = $('#save-tiebreak');
  button.disabled = true;
  $('#tie-status').textContent = 'Gemmer…';
  try {
    await api('/api/tiebreak', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        pollId: state.poll.id,
        name: state.name,
        round: state.election.round,
        gameId: state.tiebreakChoice
      })
    });
    $('#tie-status').textContent = 'Gemt ✓';
    await loadState();
  } catch (e) {
    $('#tie-status').textContent = e.message;
    if ($('#save-tiebreak')) $('#save-tiebreak').disabled = false;
  }
}

function winnerShowcase(winner, mainResults, hadTiebreak = false) {
  if (!winner) return '';
  const mainWinner = mainResults?.games?.find((game) => game.id === winner.id);
  const support = mainWinner?.count;
  const total = mainResults?.voterCount || state.config?.voters?.length || 5;
  const supportText = Number.isInteger(support)
    ? `${support} af ${total} ville spille det i grundafstemningen.`
    : 'Vinderen af månedens afstemning.';

  return `
    <div class="card success-card winner-showcase">
      <div class="winner-trophy" aria-hidden="true">🏆</div>
      <div class="winner-visual">${coverHtml(winner, 'result-cover winner-cover')}</div>
      <div class="winner-copy">
        <p class="eyebrow">Månedens spil</p>
        <div class="winner">${esc(winner.name)}</div>
        <p class="winner-support">${esc(supportText)}</p>
        ${hadTiebreak ? '<p class="small winner-tie-note">Afgjort efter omstemning.</p>' : ''}
      </div>
    </div>`;
}

function renderDone(data) {
  $('#vote-content').innerHTML = data.winner
    ? `${winnerShowcase(data.winner, data.mainResults, Boolean(data.tiebreakRounds?.length))}
       <div class="card"><strong>Resultatet er klar.</strong><p class="help">Se alle stemmer under fanen Resultat.</p></div>`
    : `<div class="card success-card"><p class="eyebrow">Afstemningen er lukket</p><div class="winner">Ingen vinder</div><p class="help">Der blev ikke afgivet stemmer på nogen spil.</p></div>`;
}

async function loadState() {
  if (!state.poll) return;
  try {
    const data = await api(`/api/state?pollId=${encodeURIComponent(state.poll.id)}&viewer=${encodeURIComponent(state.name)}`);
    state.election = data;
    renderProgress(data);
    if (data.phase === 'main') renderMainVote(data);
    else if (data.phase === 'tiebreak') renderTiebreak(data);
    else if (data.phase === 'done') renderDone(data);
    else $('#vote-content').innerHTML = '<div class="notice">Afstemningen kræver manuel afgørelse.</div>';
  } catch (e) {
    $('#vote-content').innerHTML = `<div class="notice">${esc(e.message)}</div>`;
  }
}

function renderGameResults(games) {
  const max = Math.max(1, ...games.map(g => g.count));
  return games.map((g, i) => `
    <div class="result-row">
      <div class="result-top">
        <div class="result-game">
          ${imageUrl(g) ? `<img class="result-cover" src="${esc(imageUrl(g))}" alt="${esc(g.name)}">` : ''}
          <div class="rank-name"><span class="rank">${i+1}</span><span>${esc(g.name)}</span></div>
        </div>
        <div class="count">${g.count}</div>
      </div>
      <div class="voters">${g.voters.length ? esc(g.voters.join(', ')) : 'Ingen stemmer'}</div>
      <div class="bar"><span style="width:${(g.count/max)*100}%"></span></div>
    </div>
  `).join('');
}

async function loadResults() {
  $('#results-content').innerHTML = '<div class="card">Henter resultat…</div>';
  try {
    const data = await api(`/api/results?pollId=${encodeURIComponent(state.poll.id)}`);
    if (data.locked) {
      $('#results-content').innerHTML = `
        <div class="card locked">
          <h2>Resultatet er skjult</h2>
          <p>${esc(data.message)}</p>
          <p class="small">${data.voterCount}/${data.totalVoters} har stemt. ${data.missing.length ? `Mangler: ${esc(data.missing.join(', '))}.` : ''}</p>
        </div>`;
      return;
    }

    const rounds = (data.tiebreakRounds || []).map(r => `
      <h3 class="section-title">Omstemning · runde ${r.round}</h3>
      ${renderGameResults(r.games)}
    `).join('');

    const active = data.phase === 'tiebreak' ? `
      <div class="card tiebreak-card">
        <strong>Omstemning runde ${data.activeRound} er i gang.</strong>
        <p class="help">${data.activeVoters.length}/5 har stemt. Mangler: ${esc((data.activeMissing || []).join(', '))}.</p>
      </div>` : '';

    const winner = data.winner
      ? winnerShowcase(data.winner, data.mainResults, Boolean(data.tiebreakRounds?.length))
      : '';

    $('#results-content').innerHTML = `
      ${winner}
      <div class="result-head"><div><h2 style="margin:0">${esc(data.title)}</h2><div class="small">${esc(formatDate(data.date))}</div></div></div>
      <h3 class="section-title" style="margin-top:10px">Grundafstemning</h3>
      ${renderGameResults(data.mainResults.games)}
      ${rounds}
      ${active}`;
  } catch (e) {
    $('#results-content').innerHTML = `<div class="notice">${esc(e.message)}</div>`;
  }
}

function buildStats(polls) {
  const complete = polls.filter(p => p.mainResults);
  const games = new Map();
  const winners = new Map();
  for (const poll of complete) {
    const participants = poll.mainResults.voterCount || 0;
    for (const g of poll.mainResults.games || []) {
      const x = games.get(g.id) || { name:g.name, votes:0, opportunities:0, appearances:0 };
      x.votes += g.count;
      x.opportunities += participants;
      x.appearances += 1;
      games.set(g.id, x);
    }
    if (poll.winner) winners.set(poll.winner.name, (winners.get(poll.winner.name) || 0) + 1);
  }
  return {
    games: [...games.values()].map(g => ({...g, rate:g.opportunities ? g.votes/g.opportunities : 0}))
      .sort((a,b)=>b.rate-a.rate || b.votes-a.votes),
    winners
  };
}

async function loadHistory() {
  $('#history-content').innerHTML = '<div class="card">Henter historik…</div>';
  try {
    const data = await api('/api/history');
    const polls = data.polls || [];
    const stats = buildStats(polls);
    const topGames = stats.games.slice(0,8).map((g,i) =>
      `<div class="player-row"><span>${i+1}. ${esc(g.name)}</span><strong>${Math.round(g.rate*100)}%</strong></div>`
    ).join('');

    const history = polls.map(p => {
      if (!p.mainResults) {
        return `<div class="card history-poll"><strong>${esc(p.title)}</strong><div class="small">${esc(formatDate(p.date))} · ${p.voters.length}/5 har stemt</div></div>`;
      }
      const winner = p.winner ? ` · Vinder: ${esc(p.winner.name)}` : '';
      const gameRows = p.mainResults.games.filter(g=>g.count>0).map(g =>
        `<div class="player-row"><span><strong>${esc(g.name)}</strong><br><span class="small">${esc(g.voters.join(', '))}</span></span><strong>${g.count}</strong></div>`
      ).join('');
      return `<details class="card history-poll"><summary>${esc(p.title)}${winner}</summary><p class="small">${esc(formatDate(p.date))}</p>${gameRows}</details>`;
    }).join('');

    $('#history-content').innerHTML = `
      <div class="stat-grid">
        <div class="stat"><strong>${polls.filter(p=>p.mainResults).length}</strong><span class="small">afsluttede grundafstemninger</span></div>
        <div class="stat"><strong>${state.config.voters.length}</strong><span class="small">faste deltagere</span></div>
      </div>
      <h2 class="section-title">Gruppens favoritter</h2>
      <div class="card"><p class="small">Stemmeandel i de afstemninger, hvor spillet var med.</p>${topGames || '<p class="small">Ingen statistik endnu.</p>'}</div>
      <h2 class="section-title">Måneder</h2>${history || '<div class="card">Ingen historik endnu.</div>'}`;
  } catch (e) {
    $('#history-content').innerHTML = `<div class="notice">${esc(e.message)}</div>`;
  }
}

async function init() {
  try {
    state.config = await api('/api/config');
    state.poll = state.config.polls.find(p => p.id === state.config.activePollId);
    if (!state.poll) throw new Error('Ingen aktiv afstemning.');

    if (!state.config.voters.includes(state.name)) {
      state.name = '';
      localStorage.removeItem('bg-voter-name');
    }

    $('#poll-title').textContent = state.poll.title;
    $('#poll-date').textContent = formatDate(state.poll.date);
    renderVoterOptions();
    updateBadge();

    if (!state.config.storageConfigured) {
      $('#setup-warning').textContent = 'Datalagringen er ikke koblet på. Stemmer kan ikke gemmes endnu.';
      $('#setup-warning').classList.remove('hidden');
    }

    try {
      const imageData = await api('/api/images');
      state.images = imageData.images || {};
    } catch (_) {
      state.images = {};
    }

    await loadState();
  } catch (e) {
    $('#setup-warning').textContent = e.message;
    $('#setup-warning').classList.remove('hidden');
  }
}

init();
