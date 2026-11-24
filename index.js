const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const TARGET_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const GCHAT_SPACE_ID = "spaces/AAQAKdeQ1Bw";

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (msg) => {
  // Ignore bots, webhooks (prevents echo loops), and other channels
  if (msg.author.bot || msg.webhookId || msg.channel.id !== TARGET_CHANNEL_ID) return;

  // Combine message text and any attachment URLs
  const attachmentLinks = msg.attachments.map(a => a.url).join('\n');
  const content = [msg.content, attachmentLinks].filter(Boolean).join('\n') || '(Sent an unsupported attachment)';
  const sender = msg.member?.displayName || msg.author.username;

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        spaceName: GCHAT_SPACE_ID,
        text: `*${sender} (Discord):* ${content}`
      })
    });

    const reply = await res.text();
    if (!res.ok) {
      console.error('Apps Script HTTP error:', res.status, reply);
    } else {
      console.log('Forwarded to Google Chat:', reply);
    }
  } catch (err) {
    console.error('Failed to forward message:', err);
  }
});

// Keep Render Web Service alive
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bridge running');
}).listen(process.env.PORT || 3000);

client.login(process.env.DISCORD_TOKEN);
