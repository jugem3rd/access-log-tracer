"""
Access Log Tracer - IP Address Analysis Tool

This module provides functionality to extract IP addresses from log text and
determine their geographic location using MaxMind's GeoLite2 database.

IMPORTANT COMMERCIAL USE NOTICE:
- This application uses MaxMind's GeoLite2 Country database
- For commercial use, please review MaxMind's current terms of service
- GeoLite2 data is provided by MaxMind under their license terms
- Consider upgrading to GeoIP2 for production commercial use

Data Source: MaxMind GeoLite2 Country Database
License: MaxMind GeoLite2 License
(see https://www.maxmind.com/en/geolite2/eula)
"""

import re
import ipaddress
from collections import Counter, defaultdict
import geoip2.database
import geoip2.errors
import requests
import csv
import io

# GeoLite2 database configuration
# Note: For commercial use, consider upgrading to GeoIP2
IP_PATTERN = re.compile(r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b")
DB_PATH = "GeoLite2-Country.mmdb"

try:
    reader_ja = geoip2.database.Reader(DB_PATH, locales=["ja"])
    reader_en = geoip2.database.Reader(DB_PATH, locales=["en"])
except FileNotFoundError:
    reader_ja = None
    reader_en = None


def get_urlhaus_malicious_ips():
    """URLhausから悪意のあるIPアドレスのリストを取得する"""
    try:
        url = "https://urlhaus.abuse.ch/downloads/csv_online/"
        response = requests.get(url, timeout=30)
        response.raise_for_status()

        malicious_ips = set()
        csv_reader = csv.reader(io.StringIO(response.text))

        for row in csv_reader:
            if len(row) >= 3:  # 最低限の列数があることを確認
                # CSVの各行からIPアドレスを抽出
                for field in row:
                    # フィールド内のIPアドレスを検索
                    ips = IP_PATTERN.findall(field)
                    for ip in ips:
                        try:
                            # 有効なIPアドレスかチェック
                            ipaddress.ip_address(ip)
                            malicious_ips.add(ip)
                        except ValueError:
                            continue

        return malicious_ips
    except Exception as e:
        print(f"URLhausデータの取得に失敗しました: {e}")
        return set()


def get_country_info(ip_address, language="ja"):
    """IPアドレスから国名と国コードを取得する"""
    if reader_ja is None or reader_en is None:
        return "不明" if language == "ja" else "Unknown", "N/A"

    try:
        if ipaddress.ip_address(ip_address).is_private:
            private_text = "プライベートIP" if language == "ja" else "Private IP"
            return private_text, "PR"

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
        print(f"IP: {ip_address}, Language: {language}, " f"Country: {country_name}")

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

    # URLhausから悪意のあるIPアドレスを取得
    malicious_ips = get_urlhaus_malicious_ips()

    # マッチした悪意のあるIPアドレスを特定
    matched_malicious_ips = []
    for ip in unique_ips:
        if ip in malicious_ips:
            matched_malicious_ips.append(ip)

    ip_to_country_info = {ip: get_country_info(ip, language) for ip in unique_ips}

    ip_details = []
    for ip, count in ip_counter.items():
        name, code = ip_to_country_info[ip]
        is_malicious = ip in malicious_ips
        ip_details.append(
            {
                "ip": ip,
                "count": count,
                "country_name": name,
                "country_code": code,
                "is_malicious": is_malicious,
            }
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
            "malicious_ips_found": len(matched_malicious_ips),
        },
        "ip_list": sorted(ip_details, key=lambda x: x["count"], reverse=True),
        "country_summary": sorted(
            country_summary, key=lambda x: x["count"], reverse=True
        ),
        "malicious_ips": sorted(matched_malicious_ips),
    }
