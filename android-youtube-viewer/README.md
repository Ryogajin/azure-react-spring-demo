# YouTube Viewer (Android)

`android-youtube-viewer` は、Android の `WebView` で YouTube を表示するシンプルなサンプルアプリです。

## 機能

- `https://m.youtube.com/` をアプリ内表示
- JavaScript / DOM Storage を有効化
- 端末の戻るボタンで WebView 履歴を戻る

## 必要環境

- Android Studio Ladybug 以降（推奨）
- Android SDK 35
- JDK 17

## 起動方法

```bash
cd android-youtube-viewer
./gradlew assembleDebug
```

生成された APK は `app/build/outputs/apk/debug/` 配下に出力されます。

## 注意

この実装は YouTube を `WebView` で表示する最小構成です。公開アプリで YouTube 動画の再生機能を提供する場合は、YouTube API 利用規約や配信ポリシーを必ず確認してください。
