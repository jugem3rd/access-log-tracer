import re
import ipaddress
from collections import Counter, defaultdict
import geoip2.database
import geoip2.errors

# 事前にコンパイルしておくことでパフォーマンスが向上
IP_PATTERN = re.compile(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b')
DB_PATH = 'GeoLite2-Country.mmdb'

# データベースリーダーは一度だけ読み込む
try:
    reader = geoip2.database.Reader(DB_PATH, locales=['ja'])
except FileNotFoundError:
    reader = None


def get_country_info(ip_address):
    """IPアドレスから国名と国コードを取得する"""
    if reader is None:
        return "不明", "N/A"

    try:
        # プライベートIPアドレスはGeoIPで検索できないため、先にチェック
        if ipaddress.ip_address(ip_address).is_private:
            # この関数が直接呼ばれた場合のためのフォールバックだが、
            # analyze_log_text内で事前に除外されるため、通常はこのルートを通らない
            return "プライベートIP", "PR"

        response = reader.country(ip_address)
        country_name = response.country.name or "不明"
        country_code = response.country.iso_code or "N/A"
        return country_name, country_code

    except geoip2.errors.AddressNotFoundError:
        return "不明", "N/A"
    except ValueError:
        # 不正なIPアドレス形式の場合
        return "不正なIP", "IV"


def analyze_log_text(log_text):
    """ログテキストを解析し、IPアドレス情報を集計する"""
    if reader is None:
        raise FileNotFoundError(f"GeoIPデータベース({DB_PATH})が見つかりません。MaxMindからダウンロードしてください。")

    lines = log_text.splitlines()
    all_ips_raw = IP_PATTERN.findall(log_text)

    # --- ★★★ 修正点: プライベートIPアドレスを除外する処理を追加 ★★★ ---
    public_ips = []
    for ip in all_ips_raw:
        try:
            # ipaddressオブジェクトに変換し、プライベートIPでないものだけをリストに追加
            if not ipaddress.ip_address(ip).is_private:
                public_ips.append(ip)
        except ValueError:
            # 不正なIPアドレス形式（例: 999.999.999.999）は無視する
            pass
    # --- ★★★ 修正ここまで ★★★

    # Counterとunique_ipsはフィルタリング後の公開IPリストから作成
    ip_counter = Counter(public_ips)
    unique_ips = list(ip_counter.keys())

    # 1. 各ユニークIPに対応する国情報を一度だけ取得し、辞書に格納
    ip_to_country_info = {
        ip: get_country_info(ip) for ip in unique_ips
    }

    # 2. IPごとの詳細リストを作成
    ip_details = []
    for ip, count in ip_counter.items():
        name, code = ip_to_country_info[ip]
        ip_details.append({
            "ip": ip,
            "count": count,
            "country_name": name,
            "country_code": code
        })

    # 3. 国コードを基準にアクセス数を集計
    country_counts = defaultdict(lambda: {'name': '不明', 'count': 0})
    for ip, count in ip_counter.items():
        name, code = ip_to_country_info[ip]
        country_counts[code]['name'] = name
        country_counts[code]['count'] += count

    # 4. フロントエンドが期待するリスト形式に整形
    country_summary = [
        {"country_name": data['name'], "country_code": code, "count": data['count']}
        for code, data in country_counts.items()
    ]

    # 結果を整形して返す
    # ★★★ 修正点: サマリーの値をフィルタリング後のものに更新 ★★★
    return {
        "summary": {
            "total_lines": len(lines),
            "total_ips_found": len(public_ips),      # 公開IPの延べ数
            "unique_ips_found": len(unique_ips)      # 公開IPのユニーク数
        },
        "ip_list": sorted(ip_details, key=lambda x: x['count'], reverse=True),
        "country_summary": sorted(country_summary, key=lambda x: x['count'], reverse=True)
    }