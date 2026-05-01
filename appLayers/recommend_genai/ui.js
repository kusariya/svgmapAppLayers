// ui.js
import { WebLLMEngine, checkWebGPUSupport } from './engine.js';
import { getAvailableLayers } from './analyzer.js';

// https://github.com/mlc-ai/web-llm/blob/main/src/config.ts#L293

const SELECTED_MODEL = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC"; // 日本語能力が高いQwenシリーズの最小モデル。約350MBで1GB VRAMに収まる
//const SELECTED_MODEL = "SmolLM2-360M-Instruct-q4f16_1-MLC"; // 軽量だが日本語にやや弱い


class ConciergeUI {
    constructor() {
        this.engine = new WebLLMEngine();
        this.isInitialized = false;
        this.isInitializing = false;
        this.initPromise = null;
        this.currentRecommendations = []; // 推奨結果を保持

        // DOM elements
        this.queryInput = document.getElementById('query-input');
        this.sendBtn = document.getElementById('send-btn');
        this.resultArea = document.getElementById('result-area');
        this.loadingUi = document.getElementById('loading-ui');
        this.progressBar = document.getElementById('progress-bar');
        this.progressText = document.getElementById('progress-text');
        this.presetRow = document.getElementById('preset-row');

        this.presets = [
            { label: "避難所", query: "避難場所や避難ルートを確認したい" },
            { label: "雨・台風", query: "雨雲の動きや台風の進路が知りたい" },
            { label: "地震・津波", query: "最近の地震情報や津波の危険性を確認したい" },
            { label: "観光", query: "周辺の観光スポットや飲食店を探したい" }
        ];

        this.init();
    }

    async init() {
        // WebGPUチェック
        const hasWebGPU = await checkWebGPUSupport();
        if (!hasWebGPU) {
            this.setStatus("申し訳ありません。お使いのブラウザはWebGPUに対応していないか、無効になっています。最新のChrome等をご利用ください。", true);
            this.queryInput.disabled = true;
            this.sendBtn.disabled = true;
            return;
        }

        // イベントリスナー
        this.sendBtn.onclick = () => this.handleSearch();
        this.queryInput.onkeypress = (e) => { if (e.key === 'Enter') this.handleSearch(); };

        this.renderPresets();
    }

    renderPresets() {
        this.presetRow.innerHTML = '';
        this.presets.forEach(p => {
            const btn = document.createElement('button');
            btn.className = 'btn-secondary';
            btn.style.cssText = 'background: #f0f0f0; color: #555; padding: 4px 10px; border: 1px solid #ddd; border-radius: 15px; font-size: 11px; margin-bottom: 2px;';
            btn.textContent = p.label;
            btn.onclick = () => {
                this.queryInput.value = p.query;
                this.handleSearch();
            };
            this.presetRow.appendChild(btn);
        });
    }

    async ensureEngineReady() {
        if (this.isInitialized) return true;
        if (this.isInitializing) return this.initPromise;

        this.isInitializing = true;
        this.loadingUi.style.display = 'block';
        this.sendBtn.disabled = true;

        this.initPromise = (async () => {
            try {
                await this.engine.loadModel(SELECTED_MODEL, (report) => {
                    const percent = Math.round((report.progress || 0) * 100);
                    const text = report.text || "準備中...";
                    this.progressBar.style.width = `${percent}%`;
                    this.progressText.textContent = `モデルを読み込み中... ${percent}% (${text})`;
                }); // Worker利用はengine.js側でデフォルト化されたため引数を削除
                this.isInitialized = true;
                this.loadingUi.style.display = 'none';
                this.sendBtn.disabled = false;
                return true;
            } catch (e) {
                console.error("[UI] Engine initialization failed:", e);
                this.setStatus(`エンジンの起動に失敗しました: ${e.message || e}. コンソールを確認してください。`, true);
                this.isInitializing = false; // 失敗時は再度試行可能にする
                return false;
            } finally {
                this.isInitializing = false;
            }
        })();

        return this.initPromise;
    }

    async handleSearch() {
        const query = this.queryInput.value.trim();
        if (!query || this.sendBtn.disabled) return;

        if (!(await this.ensureEngineReady())) return;

        this.setStatus("AIが最適なレイヤーを考えています...");
        const originalQuery = query;
        this.queryInput.value = '';
        this.queryInput.disabled = true;
        this.sendBtn.disabled = true;

        try {
            const layers = getAvailableLayers(originalQuery);
            console.log("[UI] Filtered layers for analysis:", layers);
            
            // 入力が "test" または極端に短い場合はシンプルチャットを試す
            let recommendations;
            if (originalQuery.toLowerCase() === 'test' || originalQuery.length < 3) {
                this.setStatus("シンプルチャットテスト中...");
                const reply = await this.engine.getRecommendations(originalQuery, []);
                recommendations = [{ name: "AIからの応答", reason: reply }];
            } else {
                recommendations = await this.engine.getRecommendations(originalQuery, layers);
            }

            console.log("[UI] Received recommendations:", recommendations);
            
            if (typeof recommendations === 'string') {
                // 文字列で返ってきた場合のフォールバック
                this.renderRecommendations([{ name: "AIの回答", reason: recommendations }], layers);
            } else {
                this.renderRecommendations(recommendations, layers);
            }
        } catch (e) {
            const errorMsg = e && (e.message || String(e));
            console.error("[UI] Error in handleSearch:", e);
            
            this.setStatus(`エラーが発生しました: ${errorMsg || "原因不明のエラー"}`, true);
            this.queryInput.value = originalQuery; // 失敗時は入力を復元
        } finally {
            // クールダウン: 5秒間は再入力を無効化
            setTimeout(() => {
                this.sendBtn.disabled = false;
                this.queryInput.disabled = false;
                this.queryInput.focus();
            }, 5000);
        }
    }

    setStatus(msg, isError = false) {
        this.resultArea.innerHTML = `<div class="status-msg" style="${isError ? 'color: #d93025; font-weight: bold;' : ''}">${msg}</div>`;
    }

    renderRecommendations(recs, allLayers = []) {
        this.resultArea.innerHTML = '';
        if (!recs || recs.length === 0 || (recs.length === 1 && recs[0].name === "候補なし")) {
            this.setStatus("お探しのご要望に合うレイヤーが見つかりませんでした。別の言葉で試してみてください。");
            return;
        }

        console.log("[UI] Rendering recommendations:", recs, "Available layers:", allLayers);
        this.currentRecommendations = recs;

        // 一括表示ボタンの追加
        const batchBtn = document.createElement('button');
        batchBtn.className = 'btn-primary';
        batchBtn.style.cssText = 'width: 100%; margin-bottom: 15px; background: #34a853;';
        batchBtn.textContent = '推奨されたすべてのレイヤーを表示';
        batchBtn.onclick = () => this.handleShowAll();
        this.resultArea.appendChild(batchBtn);

        recs.forEach(rec => {
            const layerInfo = (allLayers && allLayers.find) ? (allLayers.find(l => l.name === rec.name) || { category: "不明" }) : { category: "不明" };
            
            const item = document.createElement('div');
            item.className = 'recommend-item';
            item.innerHTML = `
                <div class="layer-header">
                    <span class="layer-name">${rec.name}</span>
                    <span class="layer-cat">${layerInfo.category}</span>
                </div>
                <div class="layer-reason">${rec.reason}</div>
                <button class="btn-show" onclick="window.showLayer('${rec.name}')">地図に表示</button>
            `;
            this.resultArea.appendChild(item);
        });
    }

    handleShowAll() {
        if (!this.currentRecommendations.length) return;
        this.currentRecommendations.forEach(rec => {
            window.showLayer(rec.name);
        });
    }
}

// レイヤー表示用のグローバル関数 (SVGMap連携)
window.showLayer = function(layerName) {
    if (typeof svgMap !== 'undefined' && svgMap.getLayerId) {
        const id = svgMap.getLayerId(layerName);
        if (id) {
            svgMap.setLayerVisibility(id, true);
        } else {
            alert("レイヤーが見つかりませんでした。");
        }
    }
};

// 初期化
window.onload = () => {
    new ConciergeUI();
};
