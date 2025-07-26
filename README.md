# Access Log Tracer

## 概要

Access Log Tracerは、任意のログテキストからIPアドレスを抽出し、国別のアクセス傾向を可視化するWebアプリケーションです。IPアドレスごとの出現回数や国別のアクセス数をグラフや地図で直感的に確認できます。

## 主な機能
- ログテキストからIPv4アドレスを抽出
- GeoLite2データベースを用いた国判定
- 国別・IP別のアクセス集計
- 棒グラフ・世界地図ヒートマップによる可視化
- 国別フィルターや外部IPチェックサービス連携

## 必要要件
- Python 3.8以上
- Flask
- geoip2

## セットアップ手順

1. **リポジトリのクローン**
    ```sh
    git clone <このリポジトリのURL>
    cd access-log-tracer
    ```

2. **Python仮想環境の作成・有効化（推奨）**
    ```sh
    python3 -m venv venv
    source venv/bin/activate
    ```

3. **依存パッケージのインストール**
    ```sh
    pip install -r requirements.txt
    ```

4. **GeoLite2データベースのダウンロード**
    - 本アプリは MaxMind社の[GeoLite2 Country](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data?lang=ja) データベース（GeoLite2-Country.mmdb）を利用します。
    - **ライセンス上の理由により、mmdbファイルは本リポジトリに含まれていません。**
    - 必ずご自身でMaxMindの公式サイトからアカウント登録・利用規約同意の上、ダウンロードしてください。
    - ダウンロードした `GeoLite2-Country.mmdb` をプロジェクトのルートディレクトリ（`analyzer.py`と同じ場所）に配置してください。

5. **アプリの起動**
    ```sh
    flask run
    ```
    - ブラウザで `http://localhost:5000` にアクセスしてください。

## 注意事項
- GeoLite2データベースの再配布は禁止されています。必ず各自でダウンロードしてください。
- 本アプリは開発用サーバー（Flaskの`app.run`）で動作します。本番運用時はgunicorn等のWSGIサーバーを推奨します。

## ディレクトリ構成

```
access-log-tracer/
├── analyzer.py
├── app.py
├── GeoLite2-Country.mmdb  # ← 必ずご自身で配置
├── requirements.txt
├── static/
│   ├── css/
│   ├── data/
│   └── js/
├── templates/
└── ...
```

## ライセンス
- GeoLite2データベースはMaxMind社のライセンスに従ってご利用ください。

---

ご質問・不具合報告はIssueまたはプルリクエストでお知らせください。 
