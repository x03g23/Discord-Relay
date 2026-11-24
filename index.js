const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const TARGET_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

client.on('messageCreate', async (msg) => {
  if (msg.author.bot || msg.webhookId || msg.channel.id !== TARGET_CHANNEL_ID) return;

  await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spaceName: "spaces/AAQAKdeQ1Bw",
      text: `*${msg.member?.displayName || msg.author.username} (Discord):* ${msg.content}`
    })
  });
});

http.createServer((req, res) => res.end('Bridge running')).listen(process.env.PORT || 3000);
client.login(process.env.DISCORD_TOKEN);
