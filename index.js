const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const GCHAT_WEBHOOK = process.env.GCHAT_WEBHOOK;
const TARGET_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

client.on('messageCreate', async (msg) => {
  // Ignore bots/webhooks so messages don't bounce back and forth
  if (msg.author.bot || msg.webhookId || msg.channel.id !== TARGET_CHANNEL_ID) return;

  await fetch(GCHAT_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: `*${msg.member?.displayName || msg.author.username} (Discord):* ${msg.content}` })
  });
});

// Tiny web server so free cloud hosts keep the service alive
http.createServer((req, res) => res.end('Bridge running')).listen(process.env.PORT || 3000);
client.login(process.env.DISCORD_TOKEN);
