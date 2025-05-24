// 必要なモジュールを読み込み
const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// *********************************************************************************************************************
// 設定
// *********************************************************************************************************************

// LINE Developersで発行したチャネルアクセストークン
const CHANNEL_ACCESS_TOKEN = "WAQ0a7to4G9xei0mpUNCNZGaNAhx+rtEMIYGARyymFZUPVSZUOJgJx42wFX/k0It4sMU7rN2BCsgbW2RmcmzBXlh2PxMAYge8TGXK4N1Jj1v1P2Z0pbi8h5t9K9pE054HS0K3eyVbbdUjkxvUGs+TQdB04t89/1O/w1cDnyilFU=";

// OpenAIのAPIキー（https://platform.openai.com/account/api-keys で取得）
const OPENAI_API_KEY = "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";

// JSON形式のデータを受け取れるように設定
app.use(express.json());

// ユーザー状態保存用（開発用、サーバー再起動でリセット）
const userStates = {}; // 例: { "Uxxxx": "awaitingFreeText" }


// *********************************************************************************************************************
// 共通関数
// *********************************************************************************************************************

// 返信（reply）
const replyText = async (token, text) => {
  await axios.post("https://api.line.me/v2/bot/message/reply", {
    replyToken: token,
    messages: [{ type: "text", text }]
  }, {
    headers: {
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    }
  });
};

// Push送信
const pushText = async (userId, text) => {
  await axios.post("https://api.line.me/v2/bot/message/push", {
    to: userId,
    messages: [{ type: "text", text }]
  }, {
    headers: {
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    }
  });
};

// Quick Reply送信（共通関数）
const replyQuickReply = async (token, text, choices) => {
  const items = choices.map(c => ({
    type: "action",
    action: {
      type: "message",
      label: c.label,
      text: c.text
    }
  }));

  await axios.post("https://api.line.me/v2/bot/message/reply", {
    replyToken: token,
    messages: [{
      type: "text",
      text,
      quickReply: { items }
    }]
  }, {
    headers: {
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    }
  });
};

// *********************************************************************************************************************
// Webhookエンドポイント
// *********************************************************************************************************************

app.post("/webhook", async (req, res) => {
  console.log("受信したデータ:", JSON.stringify(req.body, null, 2));

  // イベントが存在するかチェック
  if (req.body.events && req.body.events.length > 0) {
    const event = req.body.events[0];

    // テキストメッセージかどうかチェック
    if (event.type === "message" && event.message.type === "text") {
      const userMessage = event.message.text;        // ユーザーが送ったメッセージ
      const replyToken = event.replyToken;           // 返信に必要なトークン
      const userId = event.source.userId;            // pushメッセージ用に取得

      // ***************************************
      // ステップ１：リッチメニューからの入力判定
      // ***************************************
      
      switch (userMessage) {
        case "サウナ脳語録":
          userStates[userId] = "awaitingFreeText";
          await replyText(replyToken, "質問でも愚痴でもなんでもぶっちゃけてみませんか？サウナ脳でお答えします🧖‍");
          return res.sendStatus(200);

        case "準備中１":
          userStates[userId] = "idle";
          await replyText(replyToken, "現在準備中です✨準備中って書いてあるの、読めなかった系サウナ人？");
          return res.sendStatus(200);

        case "準備中２":
          userStates[userId] = "idle";
          await replyText(replyToken, "現在準備中です✨そのタップ、未来に生きすぎててこっち追いつけませんわ！");
          return res.sendStatus(200);

        case "気まぐれプラン":
          userStates[userId] = "idle";
          await replyText(replyToken, "『気まぐれプラン』はただいま蒸され中…♨️ “押すな”って書いてあるボタン押すタイプでしょ、あなた？");
          return res.sendStatus(200);

        case "整いマイスタープラン":
          userStates[userId] = "idle";
          await replyText(replyToken, "『整いマイスタープラン』はただいま蒸され中…♨️ そこはまだ“ととのい中”です。あなたが乱しにきたんですか？");
          return res.sendStatus(200);

        case "サウナ仙人プラン":
          userStates[userId] = "idle";
          await replyText(replyToken, "『サウナ仙人プラン』はただいま蒸され中…♨️ それ選ぶの、逆に才能。ツッコミ待ち選手権優勝！");
          return res.sendStatus(200);
      }
  
      // ***************************************
      // ステップ２：まず即座に「整い中です…」と返信
      // ***************************************
      
      // 許可された自由入力の場合（リッチメニューからの操作）
      if (userStates[userId] === "awaitingFreeText") {
        userStates[userId] = "idle"; // 1度限り許可

        // LINEに返信を送る
        await replyText(replyToken, "ちょっとサウナに入って整えてます…♨️もう少しで“整った回答”をお届けします💨");
      
      // ***************************************
      // ステップ３：ChatGPTに問い合わせ
      // ***************************************
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
                 回答は200字以内です。
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
          
          // ChatGPTの返答
          const gptReply = gptRes.data.choices[0].message.content; 

          // LINEに返信を送る
          await pushText(userId, gptReply);

        } catch (error) {
          console.error("ChatGPTエラー:", error.response?.data || error.message);
        }

        // LINEサーバーへステータス200（正常）を返す
        res.sendStatus(200);
      }
        
      // 許可されいない入力の場合（リッチメニューからの操作でない
      await replyText(replyToken, "リッチメニューから操作を始めてください🧖‍♂️");
    }
  }
  res.sendStatus(200);
});

// ***************************************
// サーバー起動
// ***************************************

app.listen(PORT, () => {
  console.log(`サーバー起動完了。ポート番号: ${PORT}`);
});
