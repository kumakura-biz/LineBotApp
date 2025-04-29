const express = require("express");
const axios = require("axios");  // ← 追加（LINEにメッセージ送るため）
const app = express();
const PORT = process.env.PORT || 3000;

const CHANNEL_ACCESS_TOKEN = "WAQ0a7to4G9xei0mpUNCNZGaNAhx+rtEMIYGARyymFZUPVSZUOJgJx42wFX/k0It4sMU7rN2BCsgbW2RmcmzBXlh2PxMAYge8TGXK4N1Jj1v1P2Z0pbi8h5t9K9pE054HS0K3eyVbbdUjkxvUGs+TQdB04t89/1O/w1cDnyilFU=";

app.use(express.json());

app.post("/webhook", async (req, res) => {
  console.log("Webhookイベント受信:", req.body);

  // イベントがメッセージだったときだけ処理
  if (req.body.events && req.body.events.length > 0) {
    const event = req.body.events[0];

    if (event.type === "message" && event.message.type === "text") {
      const userMessage = event.message.text;
      const replyToken = event.replyToken;

      // LINEに返信
      try {
        await axios.post(
          "https://api.line.me/v2/bot/message/reply",
          {
            replyToken: replyToken,
            messages: [
              {
                type: "text",
                text: `あなたのメッセージ: ${userMessage}`
              }
            ]
          },
          {
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${CHANNEL_ACCESS_TOKEN}`
            }
          }
        );
      } catch (error) {
        console.error("返信エラー:", error.response ? error.response.data : error.message);
      }
    }
  }

  // LINEに「受け取ったよ」と即レス
  res.status(200).send("OK");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
