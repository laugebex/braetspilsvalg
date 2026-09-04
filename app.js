const state = { config: null, poll: null, name: localStorage.getItem('bg-voter-name') || '', selections: new Set() };
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

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

function renderGames() {
  $('#games').innerHTML = state.poll.games.map(game => `
    <label class="game ${state.selections.has(game.id) ? 'selected' : ''}">
      <input type="checkbox" value="${esc(game.id)}" ${state.selections.has(game.id) ? 'checked' : ''}>
      <span class="game-name">${esc(game.name)}</span>
    </label>`).join('');
  document.querySelectorAll('.game input').forEach(input => input.addEventListener('change', () => {
    if (input.checked) state.selections.add(input.value); else state.selections.delete(input.value);
    input.closest('.game').classList.toggle('selected', input.checked);
  }));
}

async function syncExistingVote() {
  const name = $('#name').value.trim();
  if (name.length < 2) return;
  try {
    const data = await api(`/api/my-vote?pollId=${encodeURIComponent(state.poll.id)}&name=${encodeURIComponent(name)}`);
    if (data.vote) {
      state.selections = new Set(data.vote.selections);
      renderGames();
      $('#save-status').textContent = 'Din tidligere stemme er hentet.';
    }
  } catch (_) {}
}

$('#name').value = state.name;
$('#name').addEventListener('change', () => {
  state.name = $('#name').value.trim();
  if (state.name) localStorage.setItem('bg-voter-name', state.name);
  updateBadge();
  syncExistingVote();
});

function updateBadge() {
  const badge = $('#voter-badge');
  if (state.name) { badge.textContent = state.name; badge.classList.remove('hidden'); }
  else badge.classList.add('hidden');
}

$('#save-vote').addEventListener('click', async () => {
  const button = $('#save-vote');
  const name = $('#name').value.trim();
  if (name.length < 2) { $('#save-status').textContent = 'Skriv dit navn først.'; $('#name').focus(); return; }
  button.disabled = true; $('#save-status').textContent = 'Gemmer…';
  try {
    await api('/api/vote', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ pollId: state.poll.id, name, selections: [...state.selections] })
    });
    state.name = name; localStorage.setItem('bg-voter-name', name); updateBadge();
    $('#save-status').textContent = 'Gemt ✓';
    setTimeout(() => setTab('results'), 450);
  } catch (e) { $('#save-status').textContent = e.message; }
  finally { button.disabled = false; }
});

function renderResults(data) {
  if (data.locked) {
    $('#results-content').innerHTML = `<div class="card locked"><h2>Stem først</h2><p>${esc(data.message)}</p><p class="small">${data.voterCount || 0} har stemt indtil videre.</p></div>`;
    return;
  }
  const max = Math.max(1, ...data.games.map(g => g.count));
  const rows = data.games.map((g, i) => `
    <div class="result-row">
      <div class="result-top"><div class="rank-name"><span class="rank">${i+1}</span>${esc(g.name)}</div><div class="count">${g.count}</div></div>
      <div class="voters">${g.voters.length ? esc(g.voters.join(', ')) : 'Ingen stemmer endnu'}</div>
      <div class="bar"><span style="width:${(g.count/max)*100}%"></span></div>
    </div>`).join('');
  $('#results-content').innerHTML = `
    <div class="result-head"><div><h2 style="margin:0">${esc(data.title)}</h2><div class="small">${data.voterCount} har stemt: ${esc(data.voters.join(', ') || 'ingen endnu')}</div></div></div>
    ${rows}`;
}

async function loadResults() {
  $('#results-content').innerHTML = '<div class="card">Henter resultat…</div>';
  try {
    const viewer = $('#name').value.trim();
    const data = await api(`/api/results?pollId=${encodeURIComponent(state.poll.id)}&viewer=${encodeURIComponent(viewer)}`);
    renderResults(data);
  } catch (e) { $('#results-content').innerHTML = `<div class="notice">${esc(e.message)}</div>`; }
}

function buildStats(polls) {
  const unlocked = polls.filter(p => !p.locked);
  const game = new Map();
  const players = new Map();
  for (const poll of unlocked) {
    const participants = poll.votes?.length || 0;
    for (const g of poll.games || []) {
      const x = game.get(g.id) || { name:g.name, votes:0, opportunities:0, appearances:0, played:0 };
      x.votes += g.count; x.opportunities += participants; x.appearances += 1;
      if ((poll.played || []).includes(g.id)) x.played += 1;
      game.set(g.id, x);
    }
    for (const vote of poll.votes || []) {
      const p = players.get(vote.name) || { polls:0, total:0, games:new Map() };
      p.polls += 1; p.total += vote.selections.length;
      for (const id of vote.selections) {
        const name = (poll.games || []).find(g => g.id === id)?.name || id;
        p.games.set(name, (p.games.get(name) || 0) + 1);
      }
      players.set(vote.name, p);
    }
  }
  const games = [...game.values()].map(g => ({...g, rate: g.opportunities ? g.votes/g.opportunities : 0})).sort((a,b)=>b.rate-a.rate || b.votes-a.votes);
  return { games, players };
}

function renderHistory(data) {
  const polls = data.polls || [];
  const stats = buildStats(polls);
  const topGames = stats.games.slice(0,8).map((g,i)=>`<div class="player-row"><span>${i+1}. ${esc(g.name)}</span><strong>${Math.round(g.rate*100)}%</strong></div>`).join('');
  const playerRows = [...stats.players.entries()].sort((a,b)=>a[0].localeCompare(b[0],'da')).map(([name,p]) => {
    const fav = [...p.games.entries()].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0],'da')).slice(0,3).map(x=>x[0]).join(', ');
    return `<div class="player-row"><span><strong>${esc(name)}</strong><br><span class="small">${esc(fav || 'Ingen stemmer')}</span></span><span class="small">${p.polls} afstemning${p.polls===1?'':'er'}</span></div>`;
  }).join('');
  const history = polls.map(p => {
    if (p.locked) return `<div class="card history-poll"><strong>${esc(p.title)}</strong><div class="small">Resultatet er skjult, indtil du har stemt.</div></div>`;
    const gameRows = (p.games || []).filter(g=>g.count>0).map(g=>`<div class="player-row"><span><strong>${esc(g.name)}</strong><br><span class="small">${esc(g.voters.join(', '))}</span></span><strong>${g.count}</strong></div>`).join('') || '<p class="small">Ingen stemmer.</p>';
    return `<details class="card history-poll"><summary>${esc(p.title)} · ${p.voterCount} stemte</summary><p class="small">Deltagere: ${esc((p.voters||[]).join(', ') || 'ingen')}</p>${gameRows}</details>`;
  }).join('');
  $('#history-content').innerHTML = `
    <div class="stat-grid"><div class="stat"><strong>${polls.filter(p=>!p.locked).length}</strong><span class="small">afstemninger i historikken</span></div><div class="stat"><strong>${stats.players.size}</strong><span class="small">forskellige deltagere</span></div></div>
    <h2 class="section-title">Gruppens favoritter</h2><div class="card"><p class="small">Stemmeandel = stemmer / deltagere i de måneder, hvor spillet var på stemmesedlen.</p>${topGames || '<p class="small">Ingen statistik endnu.</p>'}</div>
    <h2 class="section-title">Personer</h2><div class="card">${playerRows || '<p class="small">Ingen statistik endnu.</p>'}</div>
    <h2 class="section-title">Måneder</h2>${history}`;
}

async function loadHistory() {
  $('#history-content').innerHTML = '<div class="card">Henter historik…</div>';
  try {
    const viewer = $('#name').value.trim();
    const data = await api(`/api/history?viewer=${encodeURIComponent(viewer)}`);
    renderHistory(data);
  } catch (e) { $('#history-content').innerHTML = `<div class="notice">${esc(e.message)}</div>`; }
}

async function init() {
  try {
    state.config = await api('/api/config');
    state.poll = state.config.polls.find(p => p.id === state.config.activePollId);
    if (!state.poll) throw new Error('Ingen aktiv afstemning.');
    $('#poll-title').textContent = state.poll.title;
    if (!state.config.storageConfigured) {
      $('#setup-warning').textContent = 'Appen er klar, men datalagringen mangler at blive koblet på. Stemmer kan ikke gemmes endnu.';
      $('#setup-warning').classList.remove('hidden');
    }
    renderGames(); updateBadge();
    if (state.name) await syncExistingVote();
  } catch (e) {
    $('#setup-warning').textContent = e.message; $('#setup-warning').classList.remove('hidden');
  }
}

init();
