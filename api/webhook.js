export default async function handler(req, res) {
  // Accept only POST requests from Telegram
  if (req.method !== 'POST') {
    return res.status(200).send('EpayOne Bot Webhook is Running!');
  }

  // Retrieve Bot Token strictly from Vercel Environment Variables
  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) {
    console.error('Server Error: BOT_TOKEN is missing in environment variables.');
    return res.status(500).json({ error: 'BOT_TOKEN is not configured in Vercel environment.' });
  }

  const MINI_APP_BASE_URL = "https://epayone.netlify.app"; 
  const update = req.body;

  try {
    if (update && update.message && update.message.text) {
      const userBChatId = update.message.chat.id;
      const text = update.message.text.trim();
      
      // Clean names to prevent Markdown formatting breaks (e.g., underscores in usernames)
      const rawFirstName = update.message.from?.first_name || "User";
      const userBFirstName = rawFirstName.replace(/[_*`\[]/g, '');
      const rawUsername = update.message.from?.username ? `@${update.message.from.username}` : `ID: ${userBChatId}`;
      const userBUsername = rawUsername.replace(/[_*`\[]/g, '');

      // Handle the /start command
      if (text.startsWith('/start')) {
        const parts = text.split(' ');
        let startPayload = '';

        if (parts.length > 1) {
          startPayload = parts[1].trim(); // e.g., ref_12345678
        }

        let targetWebAppUrl = MINI_APP_BASE_URL;

        // Referral verification and notify User A (Referrer)
        if (startPayload && startPayload.startsWith('ref_')) {
          const userAChatId = startPayload.replace('ref_', '').trim();

          // Anti-self-referral check: ensure User B is not User A
          if (userAChatId && userAChatId !== String(userBChatId)) {
            
            // Notification message sent to User A
            const messageForUserA = 
              `🎉 *Congratulations! New Referral Success!*\n\n` +
              `👤 *Referred User:* ${userBFirstName} (${userBUsername})\n` +
              `✅ *Status:* Successfully opened your link and verified!\n` +
              `💰 *Rewards:* *$1.00 Referral Bonus* & *30% Lifetime Commission* has been credited/activated on your account.\n\n` +
              `🚀 Keep sharing your link to earn more rewards daily!`;

            // Dispatch notification to User A via Telegram Bot API
            try {
              await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: userAChatId,
                  text: messageForUserA,
                  parse_mode: 'Markdown'
                })
              });
            } catch (errA) {
              console.error("Failed to notify User A:", errA);
            }
          }

          // Append referral payload to the Mini App URL
          const separator = targetWebAppUrl.includes('?') ? '&' : '?';
          targetWebAppUrl += `${separator}start=${encodeURIComponent(startPayload)}`;
        }

        // Inline keyboard for User B
        const inlineKeyboard = {
          inline_keyboard: [
            [
              {
                text: "🚀 Open EpayOne App",
                web_app: { url: targetWebAppUrl } // Opens Web App with User A's referral code
              }
            ],
            [
              {
                text: "📢 Official Channel",
                url: "https://t.me/TG_RX_Update"
              },
              {
                text: "💬 Support Group",
                url: "https://t.me/SRmodxPremium"
              }
            ]
          ]
        };

        const welcomeText = `👋 Hello *${userBFirstName}*!\n\n` +
          `Welcome to *EpayOne Earning Platform* 💰\n\n` +
          `🎯 Earn daily money by watching video ads, completing Telegram tasks, and inviting friends.\n\n` +
          `👇 Tap the button below to start earning:`;

        // Send welcome message and Web App button to User B
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: userBChatId,
            text: welcomeText,
            parse_mode: 'Markdown',
            reply_markup: inlineKeyboard
          })
        });
      }
    }
  } catch (error) {
    console.error("Webhook Handling Error:", error);
  }

  return res.status(200).json({ ok: true });
}
