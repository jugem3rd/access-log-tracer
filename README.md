# Access Log Tracer

## 概要

Access Log Tracerは、任意のログテキストからIPアドレスを抽出し、国別のアクセス傾向を可視化するWebアプリケーションです。IPアドレスごとの出現回数や国別のアクセス数をグラフや地図で直感的に確認できます。

デモサイトは[こちら](https://analyzer.oymt-dev.com)。 

## 主な機能
- ログテキストからIPv4アドレスを抽出
- GeoLite2データベースを用いた国判定
- 国別・IP別のアクセス集計
- 棒グラフ・世界地図ヒートマップによる可視化
- 国別フィルターや外部IPチェックサービス連携
- **URLhausによる悪意のあるIPアドレス検出機能**
- **IPアドレスのステータス表示（正常/要注意）**
- **日本語・英語の多言語対応**

## 必要要件
- Python 3.8以上
- Flask
- geoip2
- Flask-Babel
- requests（URLhausデータ取得用）

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

## 新機能：URLhaus悪意のあるIPアドレス検出

本アプリは、URLhausのデータベースと連携して悪意のあるIPアドレスを検出する機能を搭載しています：

### 検出機能
- **リアルタイム検出**: 解析実行時にURLhausのデータベースから最新の悪意のあるIPアドレスリストを取得
- **自動マッチング**: ログから抽出されたIPアドレスとURLhausのデータベースを自動で照合
- **視覚的表示**: 検出されたIPアドレスを専用セクションで警告表示

### 表示機能
- **要注意IPセクション**: 検出されたIPアドレスをカード形式で表示
- **ステータス表示**: 各IPアドレスに「正常」「要注意」のステータスを表示
- **フィルター機能**: ステータス別（すべて/正常/要注意）でIPアドレスを絞り込み可能
- **サマリー表示**: 要注意IPアドレスの数をサマリーに表示

### データソース
- **URLhaus**: https://urlhaus.abuse.ch/downloads/csv_online/
- **更新頻度**: 解析実行時にリアルタイムで最新データを取得

## 多言語対応

本アプリは日本語と英語の多言語対応をしています：

- **言語切り替え**: 画面右上の言語切り替えボタンで日本語/英語を切り替え可能
- **自動検出**: ブラウザの言語設定に基づいて初期言語を自動選択
- **セッション保存**: 選択した言語はセッションに保存され、ページ遷移後も維持

## 注意事項
- GeoLite2データベースの再配布は禁止されています。必ず各自でダウンロードしてください。
- URLhausのデータは解析実行時にリアルタイムで取得されます。インターネット接続が必要です。
- 本アプリは開発用サーバー（Flaskの`app.run`）で動作します。本番運用時はgunicorn等のWSGIサーバーを推奨します。

## ディレクトリ構成

```
access-log-tracer/
├── analyzer.py
├── app.py
├── GeoLite2-Country.mmdb  # ← 必ずご自身で配置
├── requirements.txt
├── translations/          # 翻訳ファイル
│   ├── ja/
│   └── en/
├── static/
│   ├── css/
│   ├── data/
│   └── js/
├── templates/
└── ...
```

## ライセンス
- 本アプリのソースコードは[MIT License](LICENSE)の下で公開されています。
- GeoLite2データベースはMaxMind社のライセンスに従ってご利用ください。
- サードパーティライセンスの詳細は[LICENSE-THIRD-PARTY](LICENSE-THIRD-PARTY)をご確認ください。

## 貢献
プルリクエストやIssueの報告を歓迎します。貢献していただく前に、以下の点をご確認ください：
- コードの品質と可読性
- 適切なテストの追加
- ドキュメントの更新

---

ご質問・不具合報告はIssueまたはプルリクエストでお知らせください。

---

# Access Log Tracer

## Overview

Access Log Tracer is a web application that extracts IP addresses from arbitrary log text and visualizes country-based access trends. You can intuitively check the frequency of IP addresses and country-based access counts through graphs and maps.

Demo page is [here](https://analyzer.oymt-dev.com).

## Main Features
- Extract IPv4 addresses from log text
- Country determination using GeoLite2 database
- Access aggregation by country and IP
- Visualization with bar charts and world map heatmaps
- Country filters and external IP check service integration
- **URLhaus malicious IP address detection**
- **IP address status display (Normal/Caution)**
- **Multi-language support (Japanese/English)**

## Requirements
- Python 3.8 or higher
- Flask
- geoip2
- Flask-Babel
- requests (for URLhaus data retrieval)

## Setup Instructions

1. **Clone the repository**
    ```sh
    git clone <repository URL>
    cd access-log-tracer
    ```

2. **Create and activate Python virtual environment (recommended)**
    ```sh
    python3 -m venv venv
    source venv/bin/activate
    ```

3. **Install dependencies**
    ```sh
    pip install -r requirements.txt
    ```

4. **Download GeoLite2 database**
    - This application uses MaxMind's [GeoLite2 Country](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data) database (GeoLite2-Country.mmdb).
    - **Due to licensing restrictions, the mmdb file is not included in this repository.**
    - Please download it yourself from MaxMind's official website after account registration and license agreement.
    - Place the downloaded `GeoLite2-Country.mmdb` in the project's root directory (same location as `analyzer.py`).

5. **Start the application**
    ```sh
    flask run
    ```
    - Access `http://localhost:5000` in your browser.

## New Feature: URLhaus Malicious IP Address Detection

This application includes functionality to detect malicious IP addresses by integrating with URLhaus database:

### Detection Features
- **Real-time detection**: Retrieves the latest malicious IP address list from URLhaus database during analysis
- **Automatic matching**: Automatically compares extracted IP addresses from logs with URLhaus database
- **Visual display**: Displays detected IP addresses in a dedicated warning section

### Display Features
- **Caution IP section**: Displays detected IP addresses in card format
- **Status display**: Shows "Normal" or "Caution" status for each IP address
- **Filter functionality**: Filter IP addresses by status (All/Normal/Caution)
- **Summary display**: Shows count of caution IP addresses in summary

### Data Source
- **URLhaus**: https://urlhaus.abuse.ch/downloads/csv_online/
- **Update frequency**: Retrieves latest data in real-time during analysis

## Multi-language Support

This application supports both Japanese and English:

- **Language switching**: Switch between Japanese/English using the language toggle button in the top-right corner
- **Auto-detection**: Automatically selects initial language based on browser language settings
- **Session persistence**: Selected language is saved in session and maintained across page transitions

## Important Notes
- Redistribution of the GeoLite2 database is prohibited. Please download it yourself.
- URLhaus data is retrieved in real-time during analysis. Internet connection is required.
- This application runs on a development server (Flask's `app.run`). For production use, we recommend using a WSGI server like gunicorn.

## Directory Structure

```
access-log-tracer/
├── analyzer.py
├── app.py
├── GeoLite2-Country.mmdb  # ← Must be placed by yourself
├── requirements.txt
├── translations/          # Translation files
│   ├── ja/
│   └── en/
├── static/
│   ├── css/
│   ├── data/
│   └── js/
├── templates/
└── ...
```

## License
- The source code of this application is published under the [MIT License](LICENSE).
- Please use the GeoLite2 database in accordance with MaxMind's license.
- For details on third-party licenses, please see [LICENSE-THIRD-PARTY](LICENSE-THIRD-PARTY).

## Contributing
We welcome pull requests and issue reports. Before contributing, please check the following:
- Code quality and readability
- Appropriate test additions
- Documentation updates

---

For questions and bug reports, please use Issues or Pull Requests. 
