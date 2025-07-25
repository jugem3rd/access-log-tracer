document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    const analyzeButton = document.getElementById('analyze-button');
    const logTextarea = document.getElementById('log-textarea');
    const resultsArea = document.getElementById('results-area');
    const errorAlert = document.getElementById('error-alert');
    const spinner = document.getElementById('spinner');

    // --- ★★★ 変数の変更 ★★★ ---
    // EChartsのインスタンス（棒グラフ用）
    let barChart = null;
    // Leafletのインスタンスと関連データを保持する変数
    let map = null;
    let geoJsonLayer = null;
    let infoControl = null;
    let legendControl = null;
    let countriesGeoJson = null;

    // --- ★★★ 初期化処理の変更 ★★★ ---
    // GeoJSONデータを非同期で読み込み、地図を初期化する
    initializeMapAndData();

    // --- イベントリスナー ---
    analyzeButton.addEventListener('click', handleAnalysis);

    /**
     * 解析ボタンがクリックされたときの処理
     */
    async function handleAnalysis() {
        const logText = logTextarea.value;
        setLoadingState(true);
        try {
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ log_text: logText }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'サーバーでエラーが発生しました。');
            }
            displayResults(result);
            resultsArea.classList.remove('d-none');
        } catch (error) {
            showError(error.message);
        } finally {
            setLoadingState(false);
        }
    }

    /**
     * ローディング状態のUI切り替え
     * @param {boolean} isLoading - ローディング中かどうか
     */
    function setLoadingState(isLoading) {
        if (isLoading) {
            resultsArea.classList.add('d-none');
            errorAlert.classList.add('d-none');
            spinner.classList.remove('d-none');
            analyzeButton.disabled = true;
        } else {
            spinner.classList.add('d-none');
            analyzeButton.disabled = false;
        }
    }

    /**
     * エラーメッセージの表示
     * @param {string} message - 表示するエラーメッセージ
     */
    function showError(message) {
        errorAlert.textContent = message;
        errorAlert.classList.remove('d-none');
    }

    /**
     * 解析結果を各セクションに表示する
     * @param {object} data - サーバーからの解析結果データ
     */
    function displayResults(data) {
        updateSummary(data.summary);
        updateTable(data.ip_list);
        updateBarChart(data.country_summary);
        // ★★★ Leaflet地図を更新する関数を呼び出す ★★★
        updateMap(data.country_summary);
    }

    /**
     * サマリーセクションを更新
     * @param {object} summary - サマリーデータ
     */
    function updateSummary(summary) {
        const summarySection = document.getElementById('summary-section');
        summarySection.innerHTML = `
            <div class="col-md-4 mb-2">
                <div class="card bg-light p-2"><div class="card-body">
                    <h5 class="card-title">${summary.total_lines}</h5>
                    <p class="card-text">総行数</p>
                </div></div>
            </div>
            <div class="col-md-4 mb-2">
                <div class="card bg-light p-2"><div class="card-body">
                    <h5 class="card-title">${summary.unique_ips_found}</h5>
                    <p class="card-text">ユニークIP数</p>
                </div></div>
            </div>
            <div class="col-md-4 mb-2">
                <div class="card bg-light p-2"><div class="card-body">
                    <h5 class="card-title">${summary.total_ips_found}</h5>
                    <p class="card-text">延べIP数</p>
                </div></div>
            </div>
        `;
    }

    /**
     * IPアドレス詳細テーブルを更新
     * @param {Array} ipList - IPアドレスのリスト
     */
    function updateTable(ipList) {
        const tableBody = document.getElementById('ip-table-body');
        tableBody.innerHTML = '';
        const fragment = document.createDocumentFragment();
        ipList.forEach(item => {
            const tr = document.createElement('tr');
            // ★★★ IPアドレスにAbuseIPDBへのリンクを追加 ★★★
            tr.innerHTML = `
                <td>${item.country_name} (${item.country_code})</td>
                <td><a href="https://www.abuseipdb.com/check/${item.ip}" target="_blank" rel="noopener noreferrer">${item.ip}</a></td>
                <td>${item.count}</td>
            `;
            fragment.appendChild(tr);
        });
        tableBody.appendChild(fragment);
    }

    // --- ★★★ ここからLeaflet.js関連のコード ★★★ ---

    /**
     * GeoJSONデータを読み込み、地図の初期設定を行う
     */
    async function initializeMapAndData() {
        try {
            const response = await fetch('/static/data/countries.geojson');
            if (!response.ok) throw new Error('Failed to load geojson');
            countriesGeoJson = await response.json();
            initializeMap();
        } catch (error) {
            console.error("Failed to load GeoJSON data:", error);
            showError('地図データの読み込みに失敗しました。');
        }
    }

    /**
     * Leaflet地図を初期化する
     */
    function initializeMap() {
        if (map) return; // すでに初期化済みなら何もしない

        map = L.map('world-map').setView([20, 0], 2);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            minZoom: 2,
            maxZoom: 10
        }).addTo(map);

        // 右上の情報表示コントロール
        infoControl = L.control();
        infoControl.onAdd = function (map) {
            this._div = L.DomUtil.create('div', 'info-tooltip');
            this.update();
            return this._div;
        };
        infoControl.update = function (props) {
            this._div.innerHTML = '<h4>アクセス元</h4>' + (props ?
                `<b>${props.name_ja || props.name}</b><br />${props.access_count || 0} 件` :
                '国にカーソルを合わせてください');
        };
        infoControl.addTo(map);

        // 右下の凡例コントロール
        legendControl = L.control({ position: 'bottomright' });
        legendControl.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend');
            // 凡例の内容はデータに基づいてupdateMapで更新する
            return div;
        };
        legendControl.addTo(map);
    }

    /**
     * アクセス数に応じて色を返す
     * @param {number} count - アクセス数
     * @param {number} maxCount - 最大アクセス数
     */
    function getColor(count, maxCount) {
        if (count === 0 || maxCount === 0) return '#f0f0f0'; // データなしは薄いグレー
        const intensity = count / maxCount;
        return intensity > 0.8 ? '#800026' :
               intensity > 0.6 ? '#BD0026' :
               intensity > 0.4 ? '#E31A1C' :
               intensity > 0.2 ? '#FC4E2A' :
               intensity > 0.1 ? '#FD8D3C' :
               intensity > 0.05 ? '#FEB24C' :
               '#FED976';
    }

    /**
     * Leafletでアクセス元マップを更新
     * @param {Array} countrySummary - 国別の集計データ
     */
    function updateMap(countrySummary) {
        if (!map || !countriesGeoJson) return;

        // 既存のGeoJSONレイヤーがあれば削除
        if (geoJsonLayer) {
            map.removeLayer(geoJsonLayer);
        }

        // 国コードをキーにしたアクセス数マップを作成
        const countryDataMap = new Map(countrySummary.map(item => [item.country_code, item.count]));
        const maxCount = Math.max(...countryDataMap.values(), 0);

        // GeoJSONレイヤーのスタイル設定
        function style(feature) {
            const count = countryDataMap.get(feature.properties['ISO3166-1-Alpha-2']) || 0;
            return {
                fillColor: getColor(count, maxCount),
                weight: 1,
                opacity: 1,
                color: 'white',
                dashArray: '3',
                fillOpacity: 0.7
            };
        }

        // 各国に対するインタラクション設定
        function onEachFeature(feature, layer) {
            const countryCode = feature.properties['ISO3166-1-Alpha-2'];
            const access_count = countryDataMap.get(countryCode) || 0;
            feature.properties.access_count = access_count;

            layer.on({
                mouseover: (e) => {
                    const layer = e.target;
                    layer.setStyle({
                        weight: 3,
                        color: '#666',
                        dashArray: '',
                        fillOpacity: 0.7
                    });
                    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                        layer.bringToFront();
                    }
                    infoControl.update(layer.feature.properties);
                },
                mouseout: (e) => {
                    geoJsonLayer.resetStyle(e.target);
                    infoControl.update();
                },
                click: (e) => {
                    map.fitBounds(e.target.getBounds());
                }
            });
        }

        // GeoJSONレイヤーを作成して地図に追加
        geoJsonLayer = L.geoJson(countriesGeoJson, {
            style: style,
            onEachFeature: onEachFeature
        }).addTo(map);

        // 凡例を更新
        const grades = [0, 0.05, 0.1, 0.2, 0.4, 0.6, 0.8].map(g => Math.ceil(g * maxCount));
        let innerHTML = '';
        for (let i = 0; i < grades.length; i++) {
            const from = grades[i];
            const to = grades[i + 1];
            const color = getColor(from + 1, maxCount);
            innerHTML +=
                `<i style="background:${color}"></i> ` +
                from + (to ? `&ndash;${to}<br>` : '+');
        }
        legendControl.getContainer().innerHTML = innerHTML;
    }

    /**
     * EChartsで国別アクセス数の棒グラフを更新
     * @param {Array} countrySummary - 国別の集計データ
     */
    function updateBarChart(countrySummary) {
        const chartDom = document.getElementById('country-chart');
        if (!barChart) {
            barChart = echarts.init(chartDom);
        }

        const topCountries = countrySummary.slice(0, 15).reverse();

        const option = {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: { type: 'value', boundaryGap: [0, 0.01] },
            yAxis: {
                type: 'category',
                data: topCountries.map(item => item.country_name)
            },
            series: [{
                name: 'アクセス数',
                type: 'bar',
                data: topCountries.map(item => item.count),
                itemStyle: {
                    color: '#5470c6'
                }
            }]
        };
        barChart.setOption(option);
    }

    // ウィンドウリサイズ時にグラフと地図をリサイズ
    window.addEventListener('resize', () => {
        if (barChart) {
            barChart.resize();
        }
        if (map) {
            // Leafletは通常自動でリサイズされるが、コンテナサイズが変更されたことを明示的に伝える
            map.invalidateSize();
        }
    });
});