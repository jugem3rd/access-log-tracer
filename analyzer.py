import re
import ipaddress
from collections import Counter, defaultdict
import geoip2.database
import geoip2.errors

IP_PATTERN = re.compile(r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b")
DB_PATH = "GeoLite2-Country.mmdb"

try:
    reader = geoip2.database.Reader(DB_PATH, locales=["ja"])
except FileNotFoundError:
    reader = None


def get_country_info(ip_address):
    """IPアドレスから国名と国コードを取得する"""
    if reader is None:
        return "不明", "N/A"

    try:
        if ipaddress.ip_address(ip_address).is_private:
            return "プライベートIP", "PR"

        response = reader.country(ip_address)
        country_name = response.country.name or "不明"
        country_code = response.country.iso_code or "N/A"
        return country_name, country_code

    except geoip2.errors.AddressNotFoundError:
        return "不明", "N/A"
    except ValueError:
        return "不正なIP", "IV"


def analyze_log_text(log_text):
    """ログテキストを解析し、IPアドレス情報を集計する"""
    if reader is None:
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

    ip_to_country_info = {ip: get_country_info(ip) for ip in unique_ips}

    ip_details = []
    for ip, count in ip_counter.items():
        name, code = ip_to_country_info[ip]
        ip_details.append(
            {"ip": ip, "count": count, "country_name": name, "country_code": code}
        )

    country_counts = defaultdict(lambda: {"name": "不明", "count": 0})
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
