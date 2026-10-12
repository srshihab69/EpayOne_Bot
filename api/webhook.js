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

  // Helper function to safely escape HTML special characters
  const escapeHtml = (str) =>
    String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  try {
    if (update && update.message && update.message.text) {
      const userBChatId = update.message.chat.id;
      const text = update.message.text.trim();
      
      const rawFirstName = update.message.from?.first_name || "User";
      const userBFirstName = escapeHtml(rawFirstName);
      const rawUsername = update.message.from?.username ? `@${update.message.from.username}` : `ID: ${userBChatId}`;
      const userBUsername = escapeHtml(rawUsername);

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
            
            // Notification message for User A with blockquote
            const messageForUserA = 
              `🎉 <b>Congratulations! New Referral Success!</b>\n\n` +
              `<blockquote>👤 <b>Referred User:</b> ${userBFirstName} (${userBUsername})\n` +
              `✅ <b>Status:</b> Successfully opened your link and verified!\n` +
              `💰 <b>Rewards:</b> <b>$1.00 Referral Bonus</b> &amp; <b>30% Lifetime Commission</b> activated on your account.</blockquote>\n\n` +
              `🚀 Keep sharing your link to earn more rewards daily!`;

            // Dispatch notification to User A via Telegram Bot API
            try {
              await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: userAChatId,
                  text: messageForUserA,
                  parse_mode: 'HTML'
                })
              });
            } catch (errA) {
              console.error("Failed to notify User A:", errA);
            }
          }

          // Append referral payload to the Mini App URL
          const separator = targetWebAppUrl.includes('?') ? '&' : '?';
          targetWebAppUrl += `${separator}start=${encodeURIComponent(startPayload)}`;

          // Set User B's Menu Button specifically with the referral URL
          try {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: userBChatId,
                menu_button: {
                  type: "web_app",
                  text: "Open App",
                  web_app: { url: targetWebAppUrl }
                }
              })
            });
          } catch (menuErr) {
            console.error("Failed to set Chat Menu Button:", menuErr);
          }
        }

        // Inline keyboard with custom colored buttons (success, primary, danger)
        const inlineKeyboard = {
          inline_keyboard: [
            [
              {
                text: "🚀 Open EpayOne App",
                web_app: { url: targetWebAppUrl },
                style: "success" // Green color
              }
            ],
            [
              {
                text: "📢 Official Channel",
                url: "https://t.me/Epay_One",
                style: "primary" // Blue color
              },
              {
                text: "💬 Support",
                url: "https://t.me/GlobalSupportHQ",
                style: "danger" // Red color
              }
            ]
          ]
        };

        // Welcome text for User B with blockquote
        const welcomeText = 
          `👋 Hello <b>${userBFirstName}</b>!\n\n` +
          `<blockquote>Welcome to <b>EpayOne Earning Platform</b> 💰\n\n` +
          `🎯 Earn daily money by watching video ads, completing Telegram tasks, and inviting friends.</blockquote>\n\n` +
          `👇 Tap the button below to start earning:`;

        // Send welcome message and action buttons to User B
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: userBChatId,
            text: welcomeText,
            parse_mode: 'HTML',
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
