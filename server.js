// 必要なモジュールを読み込み
const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// ==============================
// ▼設定（自分のトークンに置き換えてください）
// ==============================

// LINE Developersで発行したチャネルアクセストークン
const CHANNEL_ACCESS_TOKEN = "WAQ0a7to4G9xei0mpUNCNZGaNAhx+rtEMIYGARyymFZUPVSZUOJgJx42wFX/k0It4sMU7rN2BCsgbW2RmcmzBXlh2PxMAYge8TGXK4N1Jj1v1P2Z0pbi8h5t9K9pE054HS0K3eyVbbdUjkxvUGs+TQdB04t89/1O/w1cDnyilFU=";

// OpenAIのAPIキー（https://platform.openai.com/account/api-keys で取得）
const OPENAI_API_KEY = "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";

// JSON形式のデータを受け取れるように設定
app.use(express.json());

// ==============================
// ▼Webhookエンドポイント
// ==============================

app.post("/webhook", async (req, res) => {
  console.log("受信したデータ:", JSON.stringify(req.body, null, 2));

  // イベントが存在するかチェック
  if (req.body.events && req.body.events.length > 0) {
    const event = req.body.events[0];

    // テキストメッセージかどうかチェック
    if (event.type === "message" && event.message.type === "text") {
      const userMessage = event.message.text;        // ユーザーが送ったメッセージ
      const replyToken = event.replyToken;           // 返信に必要なトークン
      const userId = event.source.userId; // pushメッセージ用に取得

      // ステップ１：リッチメニューからの入力判定
      if (userMessage === "サウナを探す") {
        await axios.post("https://api.line.me/v2/bot/message/reply", {
          replyToken,
          messages: [
            {
              type: "text",
              text: "地域や気分を入力してください🧖‍♂️ 例：渋谷でリフレッシュしたい"
            }
          ]
        }, {
          headers: {
            Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
            "Content-Type": "application/json"
          }
        });
        return res.sendStatus(200);
      }
      
      // ステップ２：まず即座に「整い中です…」と返信
      await axios.post("https://api.line.me/v2/bot/message/reply", {
        replyToken,
        messages: [
          {
            type: "text",
            text: "ちょっとサウナに入って整えてます…♨️もう少しで“整った回答”をお届けします💨"
          }
        ]
      }, {
        headers: {
          "Authorization": `Bearer ${CHANNEL_ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        }
      });
      
      // ステップ３：ChatGPTに問い合わせ
      try {
        // OpenAIのChatGPTにメッセージ送信
        const gptRes = await axios.post(
          "https://api.openai.com/v1/chat/completions",
          {
            model: "o4-mini-2025-04-16", // 必要に応じて "gpt-4" に変更
            messages: [
              { role: "system", 
                content: 
               `あなたはユーザーからの質問に対してすべてサウナに例えて回答するQAアシスタントです。
               語尾には『〜しましょう！』『大丈夫です！』『いけますよ！』など、相手を励ますようなポジティブな表現やサウナ―が喜びそうな表現を使ってください。
               テンションは高すぎず爽やかで、応援する雰囲気で返答してください。
               回答は100字以内です。
               回答の締めの言葉は、サウナ観点とユーザーからの質問を掛け合わせて、『意味のイノベーション』意識した新たな言葉としてください。
               その際、読み方と解説をいれてください。『解説』って言葉は不要です。
               なお、読み方は漢字の部分だけでよいです。
               記載形式は、『新語（読み方）：解説』でお願いします。`
              },
              { role: "user", 
                content: userMessage 
              }
            ]
          },
          {
            headers: {
              "Authorization": `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json"
            }
          }
        );

        const gptReply = gptRes.data.choices[0].message.content; // ChatGPTの返答

        // LINEに返信を送る
        await axios.post(
          "https://api.line.me/v2/bot/message/push",
          {
            to: userId,
            messages: [
              {
                type: "text",
                text: gptReply
              }
            ]
          },
          {
            headers: {
              "Authorization": `Bearer ${CHANNEL_ACCESS_TOKEN}`,
              "Content-Type": "application/json"
            }
          }
        );
      } catch (error) {
        console.error("エラー:", error.response?.data || error.message);
      }
    }
  }

  // LINEサーバーへステータス200（正常）を返す
  res.sendStatus(200);
});

// ==============================
// ▼サーバー起動
// ==============================

app.listen(PORT, () => {
  console.log(`サーバー起動完了。ポート番号: ${PORT}`);
});
