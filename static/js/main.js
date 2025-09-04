document.addEventListener('DOMContentLoaded', () => {
    const analyzeButton = document.getElementById('analyze-button');
    const logTextarea = document.getElementById('log-textarea');
    const resultsArea = document.getElementById('results-area');
    const errorAlert = document.getElementById('error-alert');
    const spinner = document.getElementById('spinner');
    const ipCheckServiceSelect = document.getElementById('ip-check-service');
    const statusFilterSelect = document.getElementById('status-filter');
    const countryFilterContainer = document.getElementById('country-filter-container');

    let barChart = null;
    let map = null;
    let geoJsonLayer = null;
    let infoControl = null;
    let legendControl = null;
    let countriesGeoJson = null;
    let currentIpList = [];
    let currentCountrySummary = [];

    // 翻訳テキスト
    const translations = {
        ja: {
            totalLines: '総行数',
            uniqueIps: 'ユニークIP数',
            totalIps: '延べIP数',
            maliciousIps: '要注意IP数',
            selectAll: 'すべて選択/解除',
            serverError: 'サーバーでエラーが発生しました。',
            mapDataError: '地図データの読み込みに失敗しました。',
            hoverCountry: '国にカーソルを合わせてください',
            accessCount: '件',
            accessOrigin: 'アクセス元',
            status: 'ステータス',
            malicious: '要注意',
            normal: '正常'
        },
        en: {
            totalLines: 'Total Lines',
            uniqueIps: 'Unique IPs',
            totalIps: 'Total IPs',
            maliciousIps: 'Caution IPs',
            selectAll: 'Select/Deselect All',
            serverError: 'An error occurred on the server.',
            mapDataError: 'Failed to load map data.',
            hoverCountry: 'Hover over a country',
            accessCount: 'counts',
            accessOrigin: 'Access Origin',
            status: 'Status',
            malicious: 'Caution',
            normal: 'Normal'
        }
    };

    // 現在の言語を取得
    function getCurrentLanguage() {
        return document.documentElement.lang || 'ja';
    }

    // 翻訳テキストを取得
    function t(key) {
        const lang = getCurrentLanguage();
        return translations[lang]?.[key] || key;
    }

    const ipCheckServiceUrls = {
        abuseipdb: 'https://www.abuseipdb.com/check/{ip}',
        virustotal: 'https://www.virustotal.com/gui/ip-address/{ip}',
        talos: 'https://www.talosintelligence.com/reputation_center/lookup?search={ip}',
        shodan: 'https://www.shodan.io/host/{ip}',
        spamhaus: 'https://check.spamhaus.org/results/?query={ip}',
        greynoise: 'https://viz.greynoise.io/ip/{ip}'
    };

    initializeMapAndData();

    analyzeButton.addEventListener('click', handleAnalysis);

    ipCheckServiceSelect.addEventListener('change', () => {
        if (currentIpList.length > 0) {
            handleFilterChange();
        }
    });

    statusFilterSelect.addEventListener('change', () => {
        if (currentIpList.length > 0) {
            handleFilterChange();
        }
    });

    countryFilterContainer.addEventListener('change', handleFilterChange);

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
                throw new Error(result.error || t('serverError'));
            }
            displayResults(result);
            resultsArea.classList.remove('d-none');
        } catch (error) {
            showError(error.message);
        } finally {
            setLoadingState(false);
        }
    }

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

    function showError(message) {
        errorAlert.textContent = message;
        errorAlert.classList.remove('d-none');
    }

    function displayResults(data) {
        currentIpList = data.ip_list;
        currentCountrySummary = data.country_summary;

        updateSummary(data.summary);
        populateCountryFilters(currentCountrySummary);
        updateMaliciousIpsDisplay(data.malicious_ips || []);
        updateTable(currentIpList);

        setTimeout(() => {
            updateBarChart(currentCountrySummary);
            updateMap(currentCountrySummary);
        }, 100);
    }

    function populateCountryFilters(countrySummary) {
        countryFilterContainer.innerHTML = '';
        const fragment = document.createDocumentFragment();

        const selectAllDiv = document.createElement('div');
        selectAllDiv.className = 'form-check';
        selectAllDiv.innerHTML = `
            <input class="form-check-input" type="checkbox" value="all" id="check-all-countries" checked>
            <label class="form-check-label fw-bold" for="check-all-countries">
                ${t('selectAll')}
            </label>
        `;
        fragment.appendChild(selectAllDiv);

        countrySummary.forEach(country => {
            const countryDiv = document.createElement('div');
            countryDiv.className = 'form-check';
            const countryCode = country.country_code;
            const countryName = country.country_name;
            const count = country.count;

            countryDiv.innerHTML = `
                <input class="form-check-input country-filter-check" type="checkbox" value="${countryCode}" id="check-${countryCode}" checked>
                <label class="form-check-label" for="check-${countryCode}">
                    ${countryName} (${count})
                </label>
            `;
            fragment.appendChild(countryDiv);
        });

        countryFilterContainer.appendChild(fragment);
    }

    function handleFilterChange(event) {
        if (!countryFilterContainer.hasChildNodes()) return;

        const selectAllCheckbox = document.getElementById('check-all-countries');
        const countryCheckboxes = countryFilterContainer.querySelectorAll('.country-filter-check');

        if (event && event.target.id === 'check-all-countries') {
            countryCheckboxes.forEach(checkbox => {
                checkbox.checked = selectAllCheckbox.checked;
            });
        }

        const allChecked = [...countryCheckboxes].every(checkbox => checkbox.checked);
        selectAllCheckbox.checked = allChecked;

        const selectedCountries = [...countryCheckboxes]
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.value);

        // ステータスフィルターを取得
        const statusFilter = statusFilterSelect.value;

        // 国別フィルターとステータスフィルターを適用
        let filteredIpList = currentIpList.filter(ipItem =>
            selectedCountries.includes(ipItem.country_code)
        );

        // ステータスフィルターを適用
        if (statusFilter !== 'all') {
            filteredIpList = filteredIpList.filter(ipItem => {
                if (statusFilter === 'malicious') {
                    return ipItem.is_malicious === true;
                } else if (statusFilter === 'normal') {
                    return ipItem.is_malicious === false;
                }
                return true;
            });
        }

        updateTable(filteredIpList);
        updateBarChart(currentCountrySummary);
        updateMap(currentCountrySummary);
    }

    function updateSummary(summary) {
        const summarySection = document.getElementById('summary-section');
        const maliciousCount = summary.malicious_ips_found || 0;
        summarySection.innerHTML = `
            <div class="col-md-3 mb-2">
                <div class="card bg-light p-2"><div class="card-body">
                    <h5 class="card-title">${summary.total_lines}</h5>
                    <p class="card-text">${t('totalLines')}</p>
                </div></div>
            </div>
            <div class="col-md-3 mb-2">
                <div class="card bg-light p-2"><div class="card-body">
                    <h5 class="card-title">${summary.unique_ips_found}</h5>
                    <p class="card-text">${t('uniqueIps')}</p>
                </div></div>
            </div>
            <div class="col-md-3 mb-2">
                <div class="card bg-light p-2"><div class="card-body">
                    <h5 class="card-title">${summary.total_ips_found}</h5>
                    <p class="card-text">${t('totalIps')}</p>
                </div></div>
            </div>
            <div class="col-md-3 mb-2">
                <div class="card ${maliciousCount > 0 ? 'bg-danger text-white' : 'bg-light'} p-2">
                    <div class="card-body">
                        <h5 class="card-title">${maliciousCount}</h5>
                        <p class="card-text">${t('maliciousIps')}</p>
                    </div>
                </div>
            </div>
        `;
    }

    function updateTable(ipList) {
        const tableBody = document.getElementById('ip-table-body');
        tableBody.innerHTML = '';
        const fragment = document.createDocumentFragment();

        const selectedService = ipCheckServiceSelect.value;
        const urlTemplate = ipCheckServiceUrls[selectedService];

        ipList.forEach(item => {
            const tr = document.createElement('tr');
            const link = urlTemplate.replace('{ip}', item.ip);
            const statusClass = item.is_malicious ? 'text-danger fw-bold' : 'text-success';
            const statusText = item.is_malicious ? t('malicious') : t('normal');
            tr.innerHTML = `
                <td>${item.country_name} (${item.country_code})</td>
                <td><a href="${link}" target="_blank" rel="noopener noreferrer">${item.ip}</a></td>
                <td>${item.count}</td>
                <td><span class="${statusClass}">${statusText}</span></td>
            `;
            fragment.appendChild(tr);
        });
        tableBody.appendChild(fragment);
    }

    function updateMaliciousIpsDisplay(maliciousIps) {
        const maliciousSection = document.getElementById('malicious-ips-section');
        const maliciousList = document.getElementById('malicious-ips-list');

        if (maliciousIps.length > 0) {
            maliciousSection.style.display = 'block';
            maliciousList.innerHTML = '';

            maliciousIps.forEach(ip => {
                const ipCard = document.createElement('div');
                ipCard.className = 'col-md-3 mb-2';
                ipCard.innerHTML = `
                    <div class="card border-warning">
                        <div class="card-body text-center">
                            <h6 class="card-title text-warning">
                                <i class="bi bi-exclamation-triangle-fill"></i>
                                ${ip}
                            </h6>
                            <small class="text-muted">URLhaus</small>
                        </div>
                    </div>
                `;
                maliciousList.appendChild(ipCard);
            });
        } else {
            maliciousSection.style.display = 'none';
        }
    }

    async function initializeMapAndData() {
        try {
            const response = await fetch('/static/data/countries.geojson');
            if (!response.ok) throw new Error('Failed to load geojson');
            countriesGeoJson = await response.json();
            initializeMap();
        } catch (error) {
            console.error("Failed to load GeoJSON data:", error);
            showError(t('mapDataError'));
        }
    }

    function initializeMap() {
        if (map) return;

        const mapContainer = document.getElementById('world-map');
        if (!mapContainer) {
            console.error('Map container not found');
            return;
        }

        mapContainer.style.height = '500px';
        mapContainer.style.width = '100%';

        map = L.map('world-map').setView([20, 0], 2);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            minZoom: 2,
            maxZoom: 10
        }).addTo(map);

        infoControl = L.control();
        infoControl.onAdd = function (map) {
            this._div = L.DomUtil.create('div', 'info-tooltip');
            this.update();
            return this._div;
        };
        infoControl.update = function (props) {
            this._div.innerHTML = `<h4>${t('accessOrigin')}</h4>` + (props ?
                `<b>${props.name_ja || props.name}</b><br />${props.access_count || 0} ${t('accessCount')}` :
                t('hoverCountry'));
        };
        infoControl.addTo(map);

        legendControl = L.control({ position: 'bottomright' });
        legendControl.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend');
            return div;
        };
        legendControl.addTo(map);

        setTimeout(() => {
            if (map) {
                map.invalidateSize();
            }
        }, 100);
    }

    function getColor(count, maxCount) {
        if (count === 0 || maxCount === 0) return '#f0f0f0';
        const intensity = count / maxCount;
        return intensity > 0.8 ? '#800026' :
            intensity > 0.6 ? '#BD0026' :
                intensity > 0.4 ? '#E31A1C' :
                    intensity > 0.2 ? '#FC4E2A' :
                        intensity > 0.1 ? '#FD8D3C' :
                            intensity > 0.05 ? '#FEB24C' :
                                '#FED976';
    }

    function updateMap(countrySummary) {
        if (!map || !countriesGeoJson) {
            console.warn('Map or GeoJSON not initialized');
            return;
        }

        if (!Array.isArray(countrySummary) || countrySummary.length === 0) {
            console.warn('No country data to display');
            return;
        }

        if (geoJsonLayer) {
            map.removeLayer(geoJsonLayer);
        }

        const countryDataMap = new Map(countrySummary.map(item => [item.country_code, item.count]));
        const maxCount = Math.max(...countryDataMap.values(), 0);

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

        function onEachFeature(feature, layer) {
            const countryCode = feature.properties['ISO3166-1-Alpha-2'];
            const access_count = countryDataMap.get(countryCode) || 0;
            feature.properties.access_count = access_count;

            layer.on({
                mouseover: (e) => {
                    const layer = e.target;
                    layer.setStyle({ weight: 3, color: '#666', dashArray: '', fillOpacity: 0.7 });
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

        geoJsonLayer = L.geoJson(countriesGeoJson, {
            style: style,
            onEachFeature: onEachFeature
        }).addTo(map);

        const grades = [0, 0.05, 0.1, 0.2, 0.4, 0.6, 0.8].map(g => Math.ceil(g * maxCount));
        let innerHTML = '';
        for (let i = 0; i < grades.length; i++) {
            const from = grades[i];
            const to = grades[i + 1];
            const color = getColor(from + 1, maxCount);
            innerHTML += `<i style="background:${color}"></i> ` + from + (to ? `&ndash;${to}<br>` : '+');
        }
        legendControl.getContainer().innerHTML = innerHTML;
    }

    function updateBarChart(countrySummary) {
        const chartDom = document.getElementById('country-chart');
        if (!chartDom) {
            console.error('Chart container not found');
            return;
        }

        if (!Array.isArray(countrySummary) || countrySummary.length === 0) {
            console.warn('No country data to display in chart');
            return;
        }

        if (!barChart) {
            barChart = echarts.init(chartDom);
        }

        const topCountries = countrySummary.slice(0, 15).reverse();

        const option = {
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: { type: 'value', boundaryGap: [0, 0.01] },
            yAxis: { type: 'category', data: topCountries.map(item => item.country_name) },
            series: [{ name: t('accessCount'), type: 'bar', data: topCountries.map(item => item.count), itemStyle: { color: '#5470c6' } }]
        };

        try {
            barChart.setOption(option, true);
        } catch (error) {
            console.error('Failed to update chart:', error);
        }
    }

    window.addEventListener('resize', () => {
        if (barChart) {
            try {
                barChart.resize();
            } catch (error) {
                console.error('Failed to resize chart:', error);
            }
        }
        if (map) {
            try {
                map.invalidateSize();
            } catch (error) {
                console.error('Failed to resize map:', error);
            }
        }
    });
});