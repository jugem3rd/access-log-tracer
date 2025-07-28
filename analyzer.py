import re
import ipaddress
from collections import Counter, defaultdict
import geoip2.database
import geoip2.errors

IP_PATTERN = re.compile(r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b")
DB_PATH = "GeoLite2-Country.mmdb"

try:
    reader_ja = geoip2.database.Reader(DB_PATH, locales=["ja"])
    reader_en = geoip2.database.Reader(DB_PATH, locales=["en"])
except FileNotFoundError:
    reader_ja = None
    reader_en = None


def get_country_info(ip_address, language="ja"):
    """IPアドレスから国名と国コードを取得する"""
    if reader_ja is None or reader_en is None:
        return "不明" if language == "ja" else "Unknown", "N/A"

    try:
        if ipaddress.ip_address(ip_address).is_private:
            return "プライベートIP" if language == "ja" else "Private IP", "PR"

        # 言語に応じて適切なリーダーを使用
        if language == "ja":
            response = reader_ja.country(ip_address)
            country_name = (
                response.country.names.get("ja") or response.country.name or "不明"
            )
        else:
            response = reader_en.country(ip_address)
            country_name = response.country.name or "Unknown"

        country_code = response.country.iso_code or "N/A"

        # デバッグ用ログ
        print(f"IP: {ip_address}, Language: {language}, Country: {country_name}")

        return country_name, country_code

    except geoip2.errors.AddressNotFoundError:
        return "不明" if language == "ja" else "Unknown", "N/A"
    except ValueError:
        return "不正なIP" if language == "ja" else "Invalid IP", "IV"


def analyze_log_text(log_text, language="ja"):
    """ログテキストを解析し、IPアドレス情報を集計する"""
    if reader_ja is None or reader_en is None:
        raise FileNotFoundError(
            f"GeoIPデータベース({DB_PATH})が見つかりません。"
            "MaxMindからダウンロードしてください。"
        )

    lines = log_text.splitlines()
    all_ips_raw = IP_PATTERN.findall(log_text)

    public_ips = []
    for ip in all_ips_raw:
        try:
            if not ipaddress.ip_address(ip).is_private:
                public_ips.append(ip)
        except ValueError:
            pass

    ip_counter = Counter(public_ips)
    unique_ips = list(ip_counter.keys())

    ip_to_country_info = {ip: get_country_info(ip, language) for ip in unique_ips}

    ip_details = []
    for ip, count in ip_counter.items():
        name, code = ip_to_country_info[ip]
        ip_details.append(
            {"ip": ip, "count": count, "country_name": name, "country_code": code}
        )

    country_counts = defaultdict(
        lambda: {"name": "不明" if language == "ja" else "Unknown", "count": 0}
    )
    for ip, count in ip_counter.items():
        name, code = ip_to_country_info[ip]
        country_counts[code]["name"] = name
        country_counts[code]["count"] += count

    country_summary = [
        {"country_name": data["name"], "country_code": code, "count": data["count"]}
        for code, data in country_counts.items()
    ]

    return {
        "summary": {
            "total_lines": len(lines),
            "total_ips_found": len(public_ips),
            "unique_ips_found": len(unique_ips),
        },
        "ip_list": sorted(ip_details, key=lambda x: x["count"], reverse=True),
        "country_summary": sorted(
            country_summary, key=lambda x: x["count"], reverse=True
        ),
    }
