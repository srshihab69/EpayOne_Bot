export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(200).send('EpayOne Bot Webhook & Referral Engine is Running!');
  }

  // Retrieve Bot Token from Vercel Environment Variables
  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) {
    console.error('Server Error: BOT_TOKEN is missing in environment variables.');
    return res.status(500).json({ error: 'BOT_TOKEN is not configured in Vercel environment.' });
  }

  const MINI_APP_BASE_URL = "https://epayone.netlify.app"; 
  const body = req.body || {};

  // Escape HTML special characters
  const escapeHtml = (str) =>
    String(str || "")
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  try {
    // TELEGRAM WEBHOOK (/start command & referral handler)
    if (body.message && body.message.text) {
      const userBChatId = body.message.chat.id;
      const text = body.message.text.trim();
      
      const rawFirstName = body.message.from?.first_name || "User";
      const userBFirstName = escapeHtml(rawFirstName);

      if (text.startsWith('/start')) {
        const parts = text.split(' ');
        let startPayload = '';

        if (parts.length > 1) {
          startPayload = parts[1].trim(); // e.g., ref_12345678
        }

        let targetWebAppUrl = MINI_APP_BASE_URL;

        // Process referral parameter if exists (Works for both Menu Button and Inline WebApp Button)
        if (startPayload) {
          const separator = targetWebAppUrl.includes('?') ? '&' : '?';
          targetWebAppUrl += `${separator}start=${encodeURIComponent(startPayload)}&tgWebAppStartParam=${encodeURIComponent(startPayload)}`;
        }

        // Set Chat Menu Button with referral URL (Referral active)
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

        // Inline keyboard with style properties and referral URL (Referral active)
        const inlineKeyboard = {
          inline_keyboard: [
            [
              {
                text: "💫 Start Earning",
                web_app: { url: targetWebAppUrl },
                style: "success"
              }
            ],
            [
              {
                text: "📢 Official Channel",
                url: "https://t.me/Epay_One",
                style: "primary"
              },
              {
                text: "🎧 Support Team",
                url: "https://t.me/EpayOne_Admin",
                style: "primary"
              }
            ]
          ]
        };

        // Welcome message with blockquote added
        const welcomeText = 
          `Hello <b>${userBFirstName}</b>!\n\n` +
          `<blockquote>Welcome to <b>EpayOne Earning Platform</b>\n\n` +
          `Earn daily income by watching video ads, completing Telegram tasks, and inviting friends.</blockquote>\n\n` +
          `Tap the button below to start earning:`;

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
    console.error("Webhook Execution Error:", error);
  }

  return res.status(200).json({ ok: true });
}
