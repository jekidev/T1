const MESSAGE_LIMIT = 1990;

/**
 * Post a research heads-up to the Discord webhook in DISCORD_WEBHOOK_URL.
 * Returns false when no webhook is configured so callers can stay silent.
 */
export async function sendDiscordNotification(text, username = 'T1 Longevity Research') {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!webhookUrl) return false;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, content: text.slice(0, MESSAGE_LIMIT) }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Discord webhook returned HTTP ${response.status}`);
  return true;
}

if (import.meta.filename === process.argv[1]) {
  const message = process.argv.slice(2).join(' ').trim();
  if (!message) {
    console.error('Usage: node integrations/discord/notify.mjs <message>');
    process.exit(2);
  }
  const sent = await sendDiscordNotification(message);
  console.log(sent ? 'Heads-up sent to Discord.' : 'DISCORD_WEBHOOK_URL is not set; nothing was sent.');
}
