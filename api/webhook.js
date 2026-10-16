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
  const FIREBASE_DB_URL = "https://epayone-default-rtdb.firebaseio.com";
  const body = req.body || {};

  // Escape HTML special characters
  const escapeHtml = (str) =>
    String(str || "")
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  // Dispatch Telegram Message
  async function sendTelegramMessage(chatId, text) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML'
        })
      });
      return await response.json();
    } catch (err) {
      console.error(`Failed to send message to ${chatId}:`, err);
      return null;
    }
  }

  try {
    // =========================================================================
    // 1. APP-TO-BOT NOTIFICATION HANDLER (Triggered by Mini App)
    // =========================================================================
    if (body.action) {
      const { action, referrerId, refereeId, refereeName, refereeUsername } = body;

      // Clean numeric IDs
      const cleanReferrerId = String(referrerId || '').replace('user_', '').trim();
      const cleanRefereeId = String(refereeId || '').replace('user_', '').trim();
      const safeName = escapeHtml(refereeName || "User");
      const safeUsername = escapeHtml(refereeUsername || `ID: ${cleanRefereeId}`);

      // Case A: User B Blocked for Multi-Account / Clone App
      if (action === 'cheat_blocked' && cleanReferrerId) {
        try {
          // Verify block status from Firebase
          const dbCheckRes = await fetch(`${FIREBASE_DB_URL}/users/${cleanRefereeId}.json`);
          const dbUser = await dbCheckRes.json();

          if (dbUser && (dbUser.isRestricted || dbUser.blockType === 'multi_account' || dbUser.strikes >= 3)) {
            const cheatAlertMessage = 
              `🚨 <b>Security Alert: Referral Attempt Blocked</b>\n\n` +
              `<blockquote>👤 <b>User:</b> ${safeName} (${safeUsername})\n` +
              `🆔 <b>User ID:</b> <code>${cleanRefereeId}</code>\n` +
              `🚫 <b>Violation:</b> Duplicate device / Multi-account clone detected.\n` +
              `⚠️ <b>Action Taken:</b> Hardware restricted. Referral bonus rejected.</blockquote>\n\n` +
              `🛡️ <i>Our anti-cheat system actively protects the platform against duplicate device abuse.</i>`;

            await sendTelegramMessage(cleanReferrerId, cheatAlertMessage);
            return res.status(200).json({ success: true, message: 'Cheat alert sent to User A' });
          }
        } catch (dbErr) {
          console.error("Firebase Verification Error (Cheat Alert):", dbErr);
        }
        return res.status(200).json({ success: false, reason: 'Verification failed' });
      }

      // Case B: 200% Verified Referral Qualification (Task / Ad Completed)
      if (action === 'referral_qualified' && cleanReferrerId && cleanRefereeId) {
        try {
          // Verify user qualification from Firebase
          const dbCheckRes = await fetch(`${FIREBASE_DB_URL}/users/${cleanRefereeId}.json`);
          const dbUser = await dbCheckRes.json();

          if (dbUser && String(dbUser.referredBy).replace('user_', '').trim() === cleanReferrerId && dbUser.referralQualified === true) {
            
            // Verify reward record exists in database
            const rewardCheck = await fetch(`${FIREBASE_DB_URL}/referral_rewards/${cleanReferrerId}/${cleanRefereeId}.json`);
            const rewardData = await rewardCheck.json();

            if (rewardData) {
              const successMessage = 
                `🎉 <b>Congratulations! Referral Verified</b> 💰\n\n` +
                `<blockquote>👤 <b>Active Member:</b> ${safeName} (${safeUsername})\n` +
                `🆔 <b>User ID:</b> <code>${cleanRefereeId}</code>\n` +
                `✅ <b>Status:</b> Completed first task successfully!\n` +
                `💵 <b>Reward:</b> <b>$1.00 Referral Bonus</b> credited.\n` +
                `📈 <b>Commission:</b> <b>30% Lifetime Earnings</b> activated.</blockquote>\n\n` +
                `🚀 <i>Keep sharing your referral link to maximize daily passive income!</i>`;

              await sendTelegramMessage(cleanReferrerId, successMessage);
              return res.status(200).json({ success: true, message: 'Referral success sent to User A' });
            }
          }
        } catch (dbErr) {
          console.error("Firebase Verification Error (Qualification):", dbErr);
        }
        return res.status(200).json({ success: false, reason: 'Qualification verification failed' });
      }
    }

    // =========================================================================
    // 2. TELEGRAM WEBHOOK (/start command handler)
    // =========================================================================
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

        // Process referral parameter
        if (startPayload && startPayload.startsWith('ref_')) {
          const userAChatId = startPayload.replace('ref_', '').replace('user_', '').trim();

          // Prevent self-referral
          if (userAChatId && userAChatId !== String(userBChatId)) {
            const separator = targetWebAppUrl.includes('?') ? '&' : '?';
            targetWebAppUrl += `${separator}start=${encodeURIComponent(startPayload)}&tgWebAppStartParam=${encodeURIComponent(startPayload)}`;

            // Set Chat Menu Button with referral URL
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
          // Note: No premature notification is sent to User A here
        } else {
          // Standard launch without referral link
          try {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: userBChatId,
                menu_button: {
                  type: "web_app",
                  text: "Open App",
                  web_app: { url: MINI_APP_BASE_URL }
                }
              })
            });
          } catch (menuErr) {}
        }

        // Inline keyboard for User B
        const inlineKeyboard = {
          inline_keyboard: [
            [
              {
                text: "🚀 Start Earning",
                web_app: { url: targetWebAppUrl }
              }
            ],
            [
              {
                text: "📢 Official Channel",
                url: "https://t.me/Epay_One"
              },
              {
                text: "💬 Support Team",
                url: "https://t.me/GlobalSupportHQ"
              }
            ]
          ]
        };

        // Welcome message for User B
        const welcomeText = 
          `👋 Hello <b>${userBFirstName}</b>!\n\n` +
          `<blockquote>Welcome to <b>EpayOne Earning Platform</b> 💰\n\n` +
          `🎯 Earn daily income by watching video ads, completing Telegram tasks, and inviting friends.</blockquote>\n\n` +
          `👇 Tap the button below to start earning:`;

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
