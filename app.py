from flask import Flask, render_template, request, jsonify
import analyzer


app = Flask(__name__)


@app.route("/")
def index():
    """トップページを表示"""
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    """ログ解析API"""
    data = request.get_json()
    if not data or "log_text" not in data:
        return jsonify({"error": "Missing log_text parameter"}), 400

    log_text = data["log_text"]
    if not log_text.strip():
        return jsonify({"error": "Log text is empty"}), 400

    try:
        analysis_result = analyzer.analyze_log_text(log_text)
        if not analysis_result["summary"]["total_ips_found"]:
            return (
                jsonify({"error": "No IP addresses found in the provided text."}),
                400,
            )
        return jsonify(analysis_result)
    except FileNotFoundError as e:
        # GeoIPデータベースが見つからない場合のエラー
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        # その他の予期せぬエラー
        app.logger.error(f"An unexpected error occurred: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500


if __name__ == "__main__":
    app.run(debug=True)
