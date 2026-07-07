# うごく、とけい 公開メモ

このサイトは静的サイトです。`index.html`、`styles.css`、`script.js` の3つだけで動きます。

## いちばん簡単

Netlify Drop に `clock-site.zip` をドラッグすると、公開URLが発行されます。

https://app.netlify.com/drop

カメラ機能は、公開URLが `https://` のときに動きます。Netlify、Vercel、Cloudflare Pages、GitHub Pages はHTTPSなので大丈夫です。

AI目線検知は MediaPipe のモデルをCDNから読み込みます。利用者のカメラ映像はブラウザ内で処理され、サーバーへ送信しません。

## 他の選択肢

- Vercel: 新しいプロジェクトとしてこのフォルダをアップロード
- GitHub Pages: リポジトリに入れて Pages を有効化
- Cloudflare Pages: 静的サイトとしてアップロード

## 公開するファイル

- `index.html`
- `styles.css`
- `script.js`
