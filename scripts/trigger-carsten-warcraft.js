async function main() {
  const url = 'https://braetspilsvalg-rg-ae2c.vercel.app/api/_oneoff-carsten-warcraft';
  const response = await fetch(url, { method: 'GET', redirect: 'follow' });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch (_) {}

  if (!response.ok || !data?.ok) {
    console.error(`Trigger failed: HTTP ${response.status} ${text}`);
    process.exit(1);
  }

  console.log(JSON.stringify(data));
}

main().catch((error) => {
  console.error(`Trigger failed: ${error.message}`);
  process.exit(1);
});
