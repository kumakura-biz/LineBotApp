// *********************************************************************************************************************
// 事前設定
// *********************************************************************************************************************
// 必要なモジュールを読み込み
const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// JSON形式のデータを受け取れるように設定
app.use(express.json());

const admin = require('firebase-admin');
const serviceAccount = require('./firebase-adminsdk.json'); // サービスアカウントファイルのパス
// Firebase初期化
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore(); // Firestoreインスタンスを作成

// ユーザー状態保存用（開発用、サーバー再起動でリセット）
const userStates = {};


// *********************************************************************************************************************
// 定義
// *********************************************************************************************************************
// LINE Developersで発行したチャネルアクセストークン
const CHANNEL_ACCESS_TOKEN =
  "WAQ0a7to4G9xei0mpUNCNZGaNAhx+rtEMIYGARyymFZUPVSZUOJgJx42wFX/k0It4sMU7rN2BCsgbW2RmcmzBXlh2PxMAYge8TGXK4N1Jj1v1P2Z0pbi8h5t9K9pE054HS0K3eyVbbdUjkxvUGs+TQdB04t89/1O/w1cDnyilFU=";

// OpenAIのAPIキー（https://platform.openai.com/account/api-keys で取得）
const OPENAI_API_KEY =
  "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";

// Google APIキー
const GOOGLE_API_KEY = "AIzaSyD0WWHV8zI8BwrPmvEN8TmAEAMRJrBe-OA";

// Google検索エンジンID
const GOOGLE_CX = "c0a13d84d771943a4";

const RICH_MENU_IDS = {
  flgBasicPlan: "richmenu-a4d81c6dfbf45b7d298fb62294530754",
  flgStandardPlan: "richmenu-9fc90b0a2078ff24ad6a1a45ea7e7b5d",
  flgProPlan: "richmenu-60a4a37b66f874c74f924f3dfcacaf22",
  flgNonActive: "richmenu-77554ddd18adb4cd961fc52e16c6ee52"
};

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

// Quick Reply送信
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

// LINEユーザープロフィール情報を取得する関数
const getUserProfile = async (userId) => {
try {
  console.log('プロフィール取得開始');  // ログで関数が呼ばれたことを確認
  const response = await axios.get(`https://api.line.me/v2/bot/profile/${userId}`, {
    headers: {
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`
    }
  });
  const profile = response.data;
  console.log('ユーザー名:', profile.displayName);
  return profile;
  } catch (error) {
    console.error('プロフィール取得エラー:', error.response ? error.response.data : error.message);  // エラーを詳細に表示
    return null;  // 取得できなかった場合はnullを返す
  }
};

// LINEユーザー情報の新規登録または更新する関数（登録/更新先：firestore）
const getOrUpdateUserInfo = async (userId, userProfile) => {
  try {
    const userRef = db.collection('users').doc(userId); // ユーザーIDでドキュメントを取得
    const userDoc = await userRef.get();

    const today = new Date().toISOString().split('T')[0];  // 日付（YYYY-MM-DD）を取得

    if (!userDoc.exists) {
      // ユーザーが存在しない場合は新規登録
      const userInfo = {
        name: userProfile.displayName,
        email: '',
        plan: 'flgBasicPlan',  // 本運用：初期プランとしてflgBasicPlanを設定
        //plan: 'flgProPlan',  // テスト中：flgProPlanを設定
        language: userProfile.language,
        pictureUrl: userProfile.pictureUrl,
        registrationDate: admin.firestore.FieldValue.serverTimestamp(),
        accessCount: 0,  // 初期アクセス回数
        lastAccessDate: today,  // 初回アクセス日の設定
      };
      await userRef.set(userInfo);  // ユーザー情報を新規登録
      console.log(`新規ユーザー情報が正常に保存されました: ${userId}`);
    } else {
      // ユーザーが存在する場合
      const userData = userDoc.data();
      const lastAccessDate = userData.lastAccessDate || "";  // 最後のアクセス日付

      if (lastAccessDate !== today) {
        // 日付が変わっていればカウントリセット
        await userRef.update({
          accessCount: 0,  // 新しい日付なのでカウントは0から
          lastAccessDate: today,  // 今日の日付に更新
        });
        console.log(`ユーザー ${userId} のアクセスカウントがリセットされました。`);
      }
    }
  } catch (error) {
    console.error('ユーザー情報の取得・更新中にエラーが発生しました:', error);
    return null;
  }
};

// ユーザープラン情報を取得する関数
const getUserPlan = async (userId) => {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.log('ユーザーが見つかりません');
      return null;
    }
    const userData = userDoc.data();
    return userData.plan;  // プラン情報を返す
  } catch (error) {
    console.error('ユーザープラン情報取得でエラーが発生しました:', error);
    return null;
  }
};

// ユーザーアクセスカウント情報を取得する関数
const getAccessLimit = async (userId) => {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.log('ユーザーが見つかりません');
      return null;
    }
    const userData = userDoc.data();
    return userData.accessCount; 
  } catch (error) {
    console.error('ユーザーアクセスカウント情報取得でエラーが発生しました:', error);
    return null;
  }
};

// アクセス回数を確認する関数
const checkAccessLimit = async (userId, plan) => {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        console.log('ユーザーが見つかりません');
        return null;
      }
      const userData = userDoc.data();
      const accessCount = userData.accessCount;
      if (plan === 'flgBasicPlan' && accessCount >= 1) {
        // Basicプランは1回まで
        await incrementAccessCount(userId); // ユーザーが何回アクセスしたかを確認するためにインクリメント
        return false;
      }

      if (plan === 'flgStandardPlan' && accessCount >= 3) {
        // Standardプランは3回まで
        await incrementAccessCount(userId); // ユーザーが何回アクセスしたかを確認するためにインクリメント
        return false;
      }

  } catch (error) {
    console.error('アクセス回数チェックでエラーが発生しました:', error);
    return null;
  }
  return true;
};

// アクセスカウントをインクリメントする関数
const incrementAccessCount = async (userId) => {
  try {
    const userRef = db.collection('users').doc(userId); // ユーザーIDでドキュメントを取得
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log('ユーザーが見つかりません');
      return false; // ユーザーが存在しない場合
    }

    const userData = userDoc.data();
    const currentAccessCount = userData.accessCount || 0;

    // アクセスカウントをインクリメント
    await userRef.update({
      accessCount: currentAccessCount + 1,
    });

    console.log(`ユーザー ${userId} のアクセスカウントがインクリメントされました。`);
    return true;
  } catch (error) {
    console.error('アクセスカウントのインクリメント中にエラーが発生しました:', error);
    return false;
  }
};

// リッチメニュー設定関数
const linkRichMenuToUser = async (userId, richMenuId) => {
  try {
    await axios.post(
      `https://api.line.me/v2/bot/user/${userId}/richmenu/${richMenuId}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        },
      }
    );
    console.log(`ユーザー ${userId} にリッチメニュー ${richMenuId} をリンクしました`);
  } catch (error) {
    console.error("リッチメニューリンクエラー:", error.response?.data || error.message);
  }
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
      const userId = event.source.userId; // ユーザーID取得
      const db = admin.firestore(); // Firestoreインスタンスの作成

      try {
        // LINEユーザープロフィール情報取得
        const userProfile = await getUserProfile(userId);
        
        // LINEユーザー情報の新規登録or更新
        await getOrUpdateUserInfo(userId, userProfile);
        
        // ユーザープラン情報取得
        const userPlan = await getUserPlan(userId);
        
        // ユーザーのアクセス制限をチェック
        const canProceed = await checkAccessLimit(userId, userPlan);
        
        // アクセス上限数チェック
        if (!canProceed) {
          if (userPlan === 'flgBasicPlan') {
            // Basicプラン用の処理
            await pushText(userId, `BasicPlan のアクセス上限数（1回）に達しました。明日以降の利用、または、上位プランへのアップグレードをお願いします🙇`);
            return res.sendStatus(200); // アクセス回数が制限されている場合はここで終了
          
          } else if (userPlan === 'flgStandardPlan') {
            // Standardプラン用の処理
            await pushText(userId, `StandardPlan のアクセス上限数（3回）に達しました。明日以降の利用、または、上位プランへのアップグレードをお願いします🙇`);
            return res.sendStatus(200); // アクセス回数が制限されている場合はここで終了
          }
        }

        if (userPlan === 'flgBasicPlan') {
          // Basicプラン用の処理
          console.log('Basicプランです。');

        } else if (userPlan === 'flgStandardPlan') {
          // Standardプラン用の処理
          console.log('Standardプランです。');

        } else if (userPlan === 'flgProPlan') {
          // Proプラン用の処理
          console.log('Proプランです。');

        } else {
          console.log('プラン情報が不明です。');
        }      
        
      } catch (error) {
        console.error('エラーが発生しました:', error);
        return res.status(500).send('エラーが発生しました');
      }

      // ***************************************
      // リッチメニューからの入力判定
      // ***************************************
      switch (userMessage) {
        case "Sauna Search - Quick Select":
          userStates[userId] = { plan: "flgBasicPlan", step: 1 };

          // エリア選択（地方）
          await replyQuickReply(replyToken, "どこの地方で整いたいですか？", [
            { label: "北海道・東北", text: "北海道・東北" },
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

        case "Sauna Search - Your Choice":
          userStates[userId] = "idle";
          await replyText(
            replyToken,
            "『Sauna Search - Your Choice』はただいま蒸され中…♨️ 押すな”って書いてあるボタン押すタイプでしょ、あなた？"
          );
          return res.sendStatus(200);

        case "Plan Selection":
          userStates[userId] = "idle";
          await replyText(
            replyToken,
            "『Plan Selection』はただいま蒸され中…♨️ Coming Soon って書いてあるの、読めなかった系サウナ人？"
          );
          return res.sendStatus(200);

        case "Sauna脳語録":
          userStates[userId] = "flgSaunaBrain";
          await replyText(
            replyToken,
            "質問でも愚痴でもなんでも、メッセージで話かけてくれれば、サウナ脳でお答えします🧖‍"
          );
          return res.sendStatus(200);

        case "Saunaあるある":
          userStates[userId] = "flgSaunaAruAru";
          await replyText(
            replyToken,
            "あなたのコメントをサウナあるあるでお答えします。！メッセージをどうぞ！"
          );
          return res.sendStatus(200);
      }

      // ***************************************
      // メイン処理（選択メニューで処理分岐）
      // ***************************************
      // ***************************************
      // サウナ脳語録の場合
      // ***************************************
      if (userStates[userId] === "flgSaunaBrain") {
        userStates[userId] = "idle"; // 1度限り許可

        // LINEに返信を送る（回答準備中メッセージ）
        await replyText(
          replyToken,
          "少々お待ちを🧖‍♂️ちょっとサウナに入ってととのえ中…♨️もう少しで“ととのった回答”をお届けします💨"
        );

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
                  content: `あなたはサウナ愛好者向けのQAアシスタントです。
                  ユーザーからの質問には、すべてサウナに関連するポジティブな表現を使って答えてください。
                  語尾は、励ましや元気づけるトーンを大切にし、「〜しましょう！」「大丈夫ですよ！」「心地よく感じられますよ！」など、温かみのある言葉で回答します。 
                  回答の内容は300字以内で、適切に励ますことを心がけてください。
                  回答の締めくくりには、サウナの精神に基づいた新しい言葉を提案し、「意味のイノベーション」を意識します。
                  この新語はサウナの観点と質問内容を掛け合わせて創造してください。読み方と解説（解説という単語は不要）も付け加えてください。
                  例: 『汗心（あせごころ）：心身ともにリフレッシュし、ポジティブなエネルギーを感じる瞬間』。`,
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
          
          // ユーザーアクセスカウントをインクリメント
          const incremented = await incrementAccessCount(userId);
          if (!incremented) {
            return res.sendStatus(200); // インクリメント失敗の場合は終了
          }

        } catch (error) {
          console.error("GPT Error:", error.message);
        }

        // LINEサーバーへステータス200（正常）を返す
        return res.sendStatus(200);
      }

      // ***************************************
      // サウナあるあるの場合
      // ***************************************
      if (userStates[userId] === "flgSaunaAruAru") {
        userStates[userId] = "idle"; // 1度限り許可

        // LINEに返信を送る（回答準備中メッセージ）
        await replyText(
          replyToken,
          "少々お待ちを🧖‍♂️インフィニティチェアーで『あるある』ととのえ中…♨️"
        );

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
                  content: `あなたはサウナに関する「あるある」をユーザーに伝えるおもしろアシスタントです。
                  ユーザーのコメントには、サウナに関する共感できる状況やユーモアを交えて答えてください。
                  テンションは適度に高めで、サウナの楽しさや意外性を感じさせる表現を使います。
                  回答は300字以内で、サウナ愛好者が思わず笑ってしまうような内容を提供します。
                  サウナならではのユニークな体験や、他のサウナ―と共感できる瞬間を描写し、ユーザーが「わかる！」と思えるようなネタを加えてください。
                  笑いを誘い、サウナ好きな仲間同士で共有したくなるような表現を目指します。`,
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
          
          // ユーザーアクセスカウントをインクリメント
          const incremented = await incrementAccessCount(userId);
          if (!incremented) {
            return res.sendStatus(200); // インクリメント失敗の場合は終了
          }

        } catch (error) {
          console.error("GPT Error:", error.message);
        }

        // LINEサーバーへステータス200（正常）を返す
        return res.sendStatus(200);
      }

      // ***************************************
      // 気まぐれプランの場合
      // ***************************************
      if (
        typeof userStates[userId] === "object" &&
        userStates[userId].plan === "flgBasicPlan"
      ) {
        const state = userStates[userId];
        switch (state.step) {
          case 1:
            state.area1 = userMessage;
            state.step = 2;
            const map = {
              "北海道・東北": ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",],
              "関東": ["茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",],
              "北陸": ["新潟県","富山県","石川県","福井県"],
              "甲信": ["山梨県","長野県"],
              "東海": ["岐阜県","静岡県","愛知県","三重県"],
              "近畿": ["滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",],
              "中国": ["鳥取県","島根県","岡山県","広島県","山口県"],
              "四国": ["徳島県","香川県","愛媛県","高知県"],
              "九州・沖縄": ["福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",],

            };
            if (map[state.area1]) {
              await replyQuickReply(
                replyToken,
                "どこの地域で整いたいですか？",
                map[state.area1].map((p) => ({ label: p, text: p }))
              );
              return res.sendStatus(200);
            }
            break;
          case 2:
            state.area2 = userMessage;
            state.step = 3;
            await replyQuickReply(replyToken, "どんな気分で整いたいですか？", [
              { label: "リフレッシュ", text: "リフレッシュ" },
              { label: "ゆったり静か", text: "ゆったり静か" },
              { label: "ガチ勢", text: "ガチ勢" },
              { label: "初心者", text: "初心者" },
              { label: "男性専用施設", text: "男性専用施設" },
              { label: "グループ", text: "グループ" },
              { label: "プライベート", text: "プライベート" },
              { label: "自然・景色", text: "自然・景色" },
            ]);
            return res.sendStatus(200);
          case 3:
            let mood = "";
            const area2 = state.area2;
            delete userStates[userId];

            switch(userMessage){
              case "リフレッシュ":
                mood = `リフレッシュ　ストレス　マッサージ`;
                break;
              case "ゆったり静か":
                mood = `ゆったり　静か　混雑してない`;
                break;
              case "ガチ勢":
                mood = `高温　灼熱　水風呂キンキン　サウナハット`;
                break;
              case "グループ":
                mood = `会話　家族　友人　カップル　夫婦`;
                break;
              case "プライベート":
                mood = `プライベートサウナ`;
                break;
              case "自然・景色":
                mood = `自然　景色　川サウナ　湖畔サウナ`;
                break;
              case "初心者":
                mood = `初心者`;
                break;
              case "男性専用施設":
                mood = `男性専用施設`;                
                break;
            }
              
            // LINEに返信を送る（回答準備中メッセージ）
            await replyText(
              replyToken,
              "少々お待ちを🧖‍♂️ちょっとサウナに入って『おすすめ施設』をととのえ中…………♨️"
            );

            // 検索クエリ
            const searchQuery = `${area2} サウナ ${mood} おすすめ`;

            try {
              // Google検索でスニペット取得
              const googleRes = await axios.get(
                "https://www.googleapis.com/customsearch/v1",
                {
                  params: {
                    key: GOOGLE_API_KEY,
                    cx: GOOGLE_CX,
                    q: searchQuery,
                    num: 5,
                  },
                }
              );

              const googleItems = googleRes.data.items || [];

              // タイトルとURLをマップ化（キーは正規化した施設名）
              const linksMap = {};
              googleItems.forEach((item) => {
                const normalizedTitle = item.title.replace(/\s+/g, "").toLowerCase();
                linksMap[normalizedTitle] = item.link;
              });

              // スニペットとしてGPTに渡す文字列（オプション）
              const snippets = googleItems.map((item) => `・${item.title}：${item.snippet}`).join('\n');

              if (googleItems.length === 0) {
                await pushText(userId, "関連施設情報が見つかりませんでした。");
                return res.sendStatus(200);
              }

              // GPTに問い合わせ（スニペット + プロンプト）
              const gptPrompt = `以下のGoogle検索スニペットを参考に、${area2}で「${mood}」気分に合うおすすめサウナ施設を3つまで紹介してください。`;

              console.log("スニペット + プロンプト");
              console.log(`${gptPrompt}\n\nスニペット情報:\n${snippets}`);
              
              const gptRes = await axios.post(
                "https://api.openai.com/v1/chat/completions",
                {
                  model: "o4-mini-2025-04-16",
                  messages: [
                    {
                      role: "system",
                      content: `あなたはユーザーから指定された地域と気分や、世の中のサウナ―の評価なども踏まえ、最適なサウナ施設を紹介するアシスタントです。
                     紹介施設は3つを上限としてください。
                     施設ごとに番号を振ってください。その番号は絵文字にしてください。
                     サウナの種類、水風呂の種類、外気浴有無、整いベッド有無、オートロウリュウ有無、アウフグース有無、マッサージ施設、食事施設なども提示情報に含めてください。
                     施設ごとに訪問したくなるサウナ―の心をくすぐるような表現で施設紹介文を含めてください。
                     その際、大袈裟で胡散臭い表現はやめてください。
                     施設ごとに区切り線を入れてください。
                     いい感じに改行を含めてください。
                     1000文字以内としてください。
                     施設のURLは不要です。`,
                    },
                    {
                      role: "user",
                      content: `${gptPrompt}\n\nスニペット情報:\n${snippets}`,
                    },
                  ],
                },
                {
                  headers: {
                    Authorization: `Bearer ${OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                }
              );

              // GPTの返答
              const gptReply = gptRes.data.choices[0].message.content;

              // LINEに返信を送る
              await pushText(userId, gptReply);
              
              // ユーザーアクセスカウントをインクリメント
              const incremented = await incrementAccessCount(userId);
              if (!incremented) {
                return res.sendStatus(200); // インクリメント失敗の場合は終了
              }
              
            } catch (error) {
              console.error("気まぐれプランエラー:", error.message);
              await pushText(
                userId,
                "申し訳ありません、情報取得に失敗しました。"
              );
            }

            // LINEサーバーへステータス200（正常）を返す
            return res.sendStatus(200);

          /*
            // プロンプト
            const prompt = `${area2}で${mood}気分にぴったりのサウナを探しています。おすすめは？`;

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
                      content: `あなたはユーザーから指定された地域と気分や、世の中のサウナ―の評価なども踏まえ、最適なサウナ施設を紹介するアシスタントです。
                     紹介施設は3つを上限としてください。
                     紹介された施設に訪問したくなるサウナ―の心をくすぐるような表現で紹介してください。
                     その際、大袈裟で胡散臭い表現はやめてください。
                     また、紹介施設のURLも提示してください。
                     サウナの種類、水風呂の種類、外気浴有無、整いベッド有無、オートロウリュウ有無、アウフグース有無、マッサージ施設、食事施設なども提示情報に含めてください。
                     いい感じに改行を含めてください。
                     500文字以上などあまりにも回答文字数が多くなる場合は、URL参照でもOKです。`
                    },
                    { role: "user", content: prompt },
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
              console.error("GPT Error:", error.message);
            }
            
            // LINEサーバーへステータス200（正常）を返す
            return res.sendStatus(200);
            */
        }
      }

      // ***************************************
      // リッチメニューからの操作でない場合
      // ***************************************
      await replyText(replyToken, "メニューから操作を始めてください🧖‍♂️");

      return res.sendStatus(200);
    }
  }
});

// ***************************************
// サーバー起動
// ***************************************

app.listen(PORT, () => {
  console.log(`サーバー起動完了。ポート番号: ${PORT}`);
});
