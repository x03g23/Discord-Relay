const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');
const crypto = require('crypto');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TARGET_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const SA_EMAIL = process.env.SA_EMAIL;
const SA_PRIVATE_KEY = (process.env.SA_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const GCHAT_SPACE_ID = "spaces/AAQAKdeQ1Bw";

// Helper: Generates a Google Chat Bot OAuth2 token using your Service Account
async function getGoogleAccessToken() {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const claim = Buffer.from(JSON.stringify({
    iss: SA_EMAIL,
    scope: 'https://googleapis.com',
    aud: 'https://googleapis.com',
    exp: now + 3600,
    iat: now
  })).toString('base64url');

  const toSign = `${header}.${claim}`;
  const signature = crypto.createSign('RSA-SHA256').update(toSign).sign(SA_PRIVATE_KEY, 'base64url');
  const jwt = `${toSign}.${signature}`;

  const res = await fetch('https://googleapis.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const data = await res.json();
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// 1. Discord -> Google Chat
client.on('messageCreate', async (msg) => {
  if (msg.author.bot || msg.webhookId || msg.channel.id !== TARGET_CHANNEL_ID) return;

  const attachmentLinks = msg.attachments.map(a => a.url).join('\n');
  const content = [msg.content, attachmentLinks].filter(Boolean).join('\n') || '(Sent an unsupported attachment)';
  const sender = msg.member?.displayName || msg.author.username;

  try {
    const token = await getGoogleAccessToken();
    const res = await fetch(`https://googleapis.com{GCHAT_SPACE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: `*${sender} (Discord):* ${content}`
      })
    });

    if (!res.ok) {
      console.error('Google Chat API error:', res.status, await res.text());
    } else {
      console.log('Forwarded Discord message to Google Chat');
    }
  } catch (err) {
    console.error('Failed to forward to Google Chat:', err);
  }
});

// 2. Google Chat -> Discord (Receives events at /gchat) & Health Check
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/gchat') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const raw = JSON.parse(body);
        const event = raw.chat?.messagePayload || raw;
        const message = event.message;
        const user = event.user || raw.chat?.user;

        if (message && user?.type !== 'BOT') {
          const sender = user?.displayName || 'Google Chat User';
          const text = message.argumentText || message.text || '(Sent an attachment)';

          const webhookRes = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: `${sender} (Google Chat)`,
              content: text
            })
          });

          if (!webhookRes.ok) {
            console.error('Discord Webhook error:', webhookRes.status, await webhookRes.text());
          } else {
            console.log('Forwarded Google Chat message to Discord');
          }
        }
      } catch (err) {
        console.error('Error handling Google Chat event:', err);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({}));
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bridge running');
}).listen(process.env.PORT || 3000);

client.login(process.env.DISCORD_TOKEN);
