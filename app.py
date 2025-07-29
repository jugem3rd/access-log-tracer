from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_babel import Babel, gettext
import analyzer

app = Flask(__name__)
app.config["SECRET_KEY"] = "your-secret-key-here"
app.config["BABEL_DEFAULT_LOCALE"] = "ja"
app.config["BABEL_SUPPORTED_LOCALES"] = ["ja", "en"]

babel = Babel(app)


def get_locale():
    if "lang" in session:
        return session["lang"]
    return request.accept_languages.best_match(["ja", "en"])


babel.init_app(app, locale_selector=get_locale)


@app.context_processor
def inject_functions():
    """テンプレートで使用する関数を注入"""
    return {"get_locale": get_locale}


@app.route("/")
def index():
    """トップページを表示"""
    return render_template("index.html")


@app.route("/change_language/<language>")
def change_language(language):
    """言語を切り替える"""
    session["lang"] = language
    return redirect(request.referrer or url_for("index"))


@app.route("/analyze", methods=["POST"])
def analyze():
    """ログ解析API"""
    data = request.get_json()
    if not data or "log_text" not in data:
        return jsonify({"error": gettext("Missing log_text parameter")}), 400

    log_text = data["log_text"]
    if not log_text.strip():
        return jsonify({"error": gettext("Log text is empty")}), 400

    try:
        # 現在の言語設定を取得
        current_language = get_locale()
        analysis_result = analyzer.analyze_log_text(log_text, current_language)
        if not analysis_result["summary"]["total_ips_found"]:
            return (
                jsonify(
                    {"error": gettext("No IP addresses found in the provided text.")}
                ),
                400,
            )
        return jsonify(analysis_result)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        app.logger.error(f"An unexpected error occurred: {e}")
        return jsonify({"error": gettext("An internal server error occurred.")}), 500


if __name__ == "__main__":
    app.run(threaded=True)
