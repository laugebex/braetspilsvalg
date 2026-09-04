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
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 40);
}

function voterKey(name) {
  return normalizeName(name).toLocaleLowerCase('da-DK');
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

function resultsForPoll(poll, votes) {
  const byGame = Object.fromEntries(
    poll.games.map((g) => [g.id, { id: g.id, name: g.name, voters: [] }])
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
    status: poll.status,
    played: poll.played || [],
    voterCount: votes.length,
    voters: votes.map((v) => v.name),
    games
  };
}

module.exports = { config, json, getPoll, normalizeName, voterKey, parseVotes, resultsForPoll };
