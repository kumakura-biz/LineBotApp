// 必要なモジュールを読み込み
const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// *********************************************************************************************************************
// 設定
// *********************************************************************************************************************

// LINE Developersで発行したチャネルアクセストークン
const CHANNEL_ACCESS_TOKEN =
  "WAQ0a7to4G9xei0mpUNCNZGaNAhx+rtEMIYGARyymFZUPVSZUOJgJx42wFX/k0It4sMU7rN2BCsgbW2RmcmzBXlh2PxMAYge8TGXK4N1Jj1v1P2Z0pbi8h5t9K9pE054HS0K3eyVbbdUjkxvUGs+TQdB04t89/1O/w1cDnyilFU=";

// OpenAIのAPIキー（https://platform.openai.com/account/api-keys で取得）
const OPENAI_API_KEY =
  "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";

// JSON形式のデータを受け取れるように設定
app.use(express.json());

// ユーザー状態保存用（開発用、サーバー再起動でリセット）
const userStates = {};

// *********************************************************************************************************************
// 共通関数
// *********************************************************************************************************************

// 返信（reply）
const replyText = async (token, text) => {
  await axios.post(
    "https://api.line.me/v2/bot/message/reply",
    {
      replyToken: token,
      messages: [{ type: "text", text }],
    },
    {
      headers: {
        Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
};

// Push送信
const pushText = async (userId, text) => {
  await axios.post(
    "https://api.line.me/v2/bot/message/push",
    {
      to: userId,
      messages: [{ type: "text", text }],
    },
    {
      headers: {
        Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
};

// Quick Reply送信（共通関数）
const replyQuickReply = async (token, text, choices) => {
  const items = choices.map((c) => ({
    type: "action",
    action: {
      type: "message",
      label: c.label,
      text: c.text,
    },
  }));

  await axios.post(
    "https://api.line.me/v2/bot/message/reply",
    {
      replyToken: token,
      messages: [
        {
          type: "text",
          text,
          quickReply: { items },
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
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
      const userMessage = event.message.text; // ユーザーが送ったメッセージ
      const replyToken = event.replyToken; // 返信に必要なトークン
      const userId = event.source.userId; // pushメッセージ用に取得

      // ***************************************
      // リッチメニューからの入力判定
      // ***************************************
      switch (userMessage) {
        case "サウナ脳語録":
          userStates[userId] = "flgSaunaBrain";
          await replyText(
            replyToken,
            "質問でも愚痴でもなんでも、メッセージで話かけてくれれば、サウナ脳でお答えします🧖‍"
          );
          return res.sendStatus(200);

        case "準備中１":
          userStates[userId] = "idle";
          await replyText(
            replyToken,
            "現在準備中です✨準備中って書いてあるの、読めなかった系サウナ人？"
          );
          return res.sendStatus(200);

        case "準備中２":
          userStates[userId] = "idle";
          await replyText(
            replyToken,
            "現在準備中です✨そのタップ、未来に生きすぎてて、こちら追いつけませんわ！"
          );
          return res.sendStatus(200);

        case "気まぐれプラン":
          userStates[userId] = { step: 1 };

          // エリア選択（地方）
          await replyQuickReply(replyToken, "どこのエリアで整いたいですか？", [
            { label: "北海道", text: "北海道" },
            { label: "東北", text: "東北" },
            { label: "関東", text: "関東" },
            { label: "北陸", text: "北陸" },
            { label: "甲信", text: "甲信" },
            { label: "東海", text: "東海" },
            { label: "近畿", text: "近畿" },
            { label: "中国", text: "中国" },
            { label: "四国", text: "四国" },
            { label: "九州・沖縄", text: "九州・沖縄" },
          ]);
          return res.sendStatus(200);

          // エリア選択（当道府県）
          if (
            typeof userStates[userId] === "object" &&
            userStates[userId].step === 1
          ) {
            userStates[userId].area1 = userMessage;
            userStates[userId].step = 2;
            
            switch (userStates[userId].area1) {
              case "北海道":
                
            }
              
            

            await replyQuickReply(replyToken, "どんな気分で整いたいですか？", [
              { label: "リフレッシュ", text: "リフレッシュ" },
              { label: "静かに整いたい", text: "静かに整いたい" },
              { label: "刺激がほしい", text: "刺激がほしい" },
              { label: "初心者向け", text: "初心者向け" },
            ]);
            return res.sendStatus(200);
          }

        case "整いマイスタープラン":
          userStates[userId] = "idle";
          await replyText(
            replyToken,
            "『整いマイスタープラン』はただいま蒸され中…♨️ 押すな”って書いてあるボタン押すタイプでしょ、あなた？"
          );
          return res.sendStatus(200);

        case "サウナ仙人プラン":
          userStates[userId] = "idle";
          await replyText(
            replyToken,
            "『サウナ仙人プラン』はただいま蒸され中…♨️ それ選ぶの、逆に才能。ツッコミ待ち選手権優勝！"
          );
          return res.sendStatus(200);
      }

      // ***************************************
      // メイン処理（選択メニューで処理分岐）
      // ***************************************
      switch (userStates[userId]) {
        // ***************************************
        // サウナ脳語録の場合
        // ***************************************
        case "flgSaunaBrain":
          userStates[userId] = "idle"; // 1度限り許可

          // LINEに返信を送る（回答準備中メッセージ）
          await replyText(
            replyToken,
            "ちょっとサウナに入って整えてます…♨️もう少しで“整った回答”をお届けします💨"
          );

          return res.sendStatus(200);

          // ChatGPTに問い合わせ
          try {
            // OpenAIのChatGPTにメッセージ送信
            const gptRes = await axios.post(
              "https://api.openai.com/v1/chat/completions",
              {
                model: "o4-mini-2025-04-16",
                messages: [
                  {
                    role: "system",
                    content: `あなたはユーザーからの質問に対してすべてサウナに例えて回答するQAアシスタントです。
                 語尾には『〜しましょう！』『大丈夫です！』『いけますよ！』など、相手を励ますようなポジティブな表現やサウナ―が喜びそうな表現を使ってください。
                 テンションは高すぎず爽やかで、応援する雰囲気で返答してください。
                 回答は200字以内です。
                 回答の締めの言葉は、サウナ観点とユーザーからの質問を掛け合わせて、『意味のイノベーション』意識した新たな言葉としてください。
                 その際、読み方と解説をいれてください。『解説』って言葉は不要です。
                 なお、読み方は漢字の部分だけでよいです。
                 記載形式は、『新語（読み方）：解説』でお願いします。`,
                  },
                  { role: "user", content: userMessage },
                ],
              },
              {
                headers: {
                  Authorization: `Bearer ${OPENAI_API_KEY}`,
                  "Content-Type": "application/json",
                },
              }
            );

            // ChatGPTの返答
            const gptReply = gptRes.data.choices[0].message.content;

            // LINEに返信を送る
            await pushText(userId, gptReply);
          } catch (error) {
            console.error(
              "ChatGPTエラー:",
              error.response?.data || error.message
            );
          }

          // LINEサーバーへステータス200（正常）を返す
          res.sendStatus(200);

        // ***************************************
        // 気まぐれプランの場合
        // ***************************************
        case "flgSaunaPlacePlan1":
          userStates[userId] = "idle"; // 1度限り許可

        // ***************************************
        // リッチメニューからの操作でない場合
        // ***************************************
        default:
          await replyText(replyToken, "メニューから操作を始めてください🧖‍♂️");
      }
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
