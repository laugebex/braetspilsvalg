const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

if (!url || !token) {
  console.error('Migration failed: Redis credentials are unavailable during build.');
  process.exit(1);
}

async function command(args) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  });
  if (!response.ok) throw new Error(`Redis error ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error);
  return payload.result;
}

async function main() {
  const key = 'braetspilsvalg:2026-09:votes';
  const voter = 'carsten';
  const gameId = 'warcraft-the-board-game';

  const raw = await command(['HGET', key, voter]);
  if (!raw) {
    console.error('Migration failed: Carsten has no stored vote.');
    process.exit(1);
  }

  const vote = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const selections = new Set(Array.isArray(vote.selections) ? vote.selections : []);

  if (selections.has(gameId)) {
    console.log('Migration no-op: Warcraft is already included in Carsten vote.');
    return;
  }

  selections.add(gameId);
  const updated = {
    ...vote,
    selections: [...selections],
    adjustedAt: new Date().toISOString(),
    adjustment: 'Added WarCraft: The Board Game at voter request'
  };

  await command(['HSET', key, voter, JSON.stringify(updated)]);
  console.log('Migration complete: Warcraft added to Carsten vote.');
}

main().catch((error) => {
  console.error(`Migration failed: ${error.message}`);
  process.exit(1);
});
