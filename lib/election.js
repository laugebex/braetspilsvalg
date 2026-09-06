const { command, votesKey, tiebreakVotesKey } = require('./redis');
const {
  parseVotes, resultsForPoll, missingVoters, votedNames, topIds, canonicalVoter, isSupersededMainVote
} = require('./shared');

function roundResults(poll, candidates, votes, round) {
  const candidateSet = new Set(candidates);
  const games = poll.games
    .filter((g) => candidateSet.has(g.id))
    .map((g) => ({ id: g.id, name: g.name, bggId: g.bggId || null, voters: [] }));

  const byId = Object.fromEntries(games.map((g) => [g.id, g]));
  for (const vote of votes) {
    const id = vote.selections?.[0];
    if (id && byId[id]) byId[id].voters.push(vote.name);
  }

  const sorted = games
    .map((g) => ({ ...g, count: g.voters.length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'da'));

  return {
    round,
    candidates,
    voterCount: votes.length,
    voters: votedNames(poll, votes),
    missing: missingVoters(poll, votes),
    games: sorted
  };
}

async function loadElection(poll) {
  const mainVotes = parseVotes(await command(['HGETALL', votesKey(poll.id)]))
    .filter((v) => canonicalVoter(poll, v.name))
    .filter((v) => !isSupersededMainVote(poll, v));
  const mainResults = resultsForPoll(poll, mainVotes);
  const mainMissing = mainResults.missing;

  if (mainMissing.length) {
    return {
      phase: 'main',
      complete: false,
      mainVotes,
      mainResults,
      missing: mainMissing,
      voters: mainResults.voters,
      rounds: [],
      winner: null
    };
  }

  let candidates = topIds(mainResults.games);
  if (candidates.length === 0) {
    return {
      phase: 'done',
      complete: true,
      mainVotes,
      mainResults,
      rounds: [],
      winner: null,
      noWinner: true
    };
  }

  if (candidates.length === 1) {
    const winner = poll.games.find((g) => g.id === candidates[0]) || null;
    return {
      phase: 'done',
      complete: true,
      mainVotes,
      mainResults,
      rounds: [],
      winner
    };
  }

  const rounds = [];
  for (let round = 1; round <= 5; round++) {
    const votes = parseVotes(await command(['HGETALL', tiebreakVotesKey(poll.id, round)])).filter((v) => canonicalVoter(poll, v.name));
    const summary = roundResults(poll, candidates, votes, round);
    rounds.push(summary);

    if (summary.missing.length) {
      return {
        phase: 'tiebreak',
        complete: false,
        mainVotes,
        mainResults,
        rounds,
        round,
        candidates,
        missing: summary.missing,
        voters: summary.voters,
        winner: null
      };
    }

    const tiedTop = topIds(summary.games);
    if (tiedTop.length === 1) {
      const winner = poll.games.find((g) => g.id === tiedTop[0]) || null;
      return {
        phase: 'done',
        complete: true,
        mainVotes,
        mainResults,
        rounds,
        winner
      };
    }

    if (tiedTop.length === 0) {
      return {
        phase: 'manual',
        complete: false,
        mainVotes,
        mainResults,
        rounds,
        winner: null
      };
    }

    candidates = tiedTop;
  }

  return {
    phase: 'manual',
    complete: false,
    mainVotes,
    mainResults,
    rounds,
    winner: null
  };
}

module.exports = { loadElection, roundResults };
