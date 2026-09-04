function credentials() {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  };
}

function storageConfigured() {
  const { url, token } = credentials();
  return Boolean(url && token);
}

async function command(args) {
  const { url, token } = credentials();
  if (!url || !token) {
    const error = new Error('STORAGE_NOT_CONFIGURED');
    error.code = 'STORAGE_NOT_CONFIGURED';
    throw error;
  }
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

function votesKey(pollId) {
  return `braetspilsvalg:${pollId}:votes`;
}

module.exports = { command, votesKey, storageConfigured };
