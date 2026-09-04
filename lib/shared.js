const config = require('../config/polls.json');

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function getPoll(pollId) {
  return config.polls.find((poll) => poll.id === pollId);
}

function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
}

function voterKey(name) {
  return normalizeName(name).toLocaleLowerCase('da-DK');
}

function allowedVoters(poll) {
  return Array.isArray(poll?.voters) && poll.voters.length ? poll.voters : (config.voters || []);
}

function canonicalVoter(poll, name) {
  const key = voterKey(name);
  return allowedVoters(poll).find((v) => voterKey(v) === key) || null;
}

function parseHgetall(result) {
  if (!result) return {};
  if (!Array.isArray(result) && typeof result === 'object') return result;
  const out = {};
  for (let i = 0; i < result.length; i += 2) out[result[i]] = result[i + 1];
  return out;
}

function parseVotes(result) {
  const raw = parseHgetall(result);
  const votes = [];
  for (const value of Object.values(raw)) {
    try {
      const vote = typeof value === 'string' ? JSON.parse(value) : value;
      if (vote && vote.name && Array.isArray(vote.selections)) votes.push(vote);
    } catch (_) {}
  }
  return votes.sort((a, b) => a.name.localeCompare(b.name, 'da'));
}

function votedNames(poll, votes) {
  const byKey = new Set(votes.map((v) => voterKey(v.name)));
  return allowedVoters(poll).filter((name) => byKey.has(voterKey(name)));
}

function missingVoters(poll, votes) {
  const voted = new Set(votes.map((v) => voterKey(v.name)));
  return allowedVoters(poll).filter((name) => !voted.has(voterKey(name)));
}

function resultsForPoll(poll, votes) {
  const byGame = Object.fromEntries(
    poll.games.map((g) => [g.id, { id: g.id, name: g.name, bggId: g.bggId || null, voters: [] }])
  );
  for (const vote of votes) {
    for (const gameId of vote.selections) {
      if (byGame[gameId]) byGame[gameId].voters.push(vote.name);
    }
  }
  const games = Object.values(byGame)
    .map((g) => ({ ...g, count: g.voters.length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'da'));
  return {
    pollId: poll.id,
    title: poll.title,
    date: poll.date || null,
    status: poll.status,
    played: poll.played || [],
    voterCount: votes.length,
    voters: votedNames(poll, votes),
    missing: missingVoters(poll, votes),
    games
  };
}

function topIds(games) {
  if (!games.length) return [];
  const max = Math.max(...games.map((g) => g.count));
  if (max <= 0) return [];
  return games.filter((g) => g.count === max).map((g) => g.id);
}

module.exports = {
  config, json, getPoll, normalizeName, voterKey, allowedVoters, canonicalVoter,
  parseVotes, votedNames, missingVoters, resultsForPoll, topIds
};
