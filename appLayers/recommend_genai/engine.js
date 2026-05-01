// engine.js
// WebLLM Engine Wrapper (Stability Optimized Version)

export async function checkWebGPUSupport() {
    const nav = typeof globalThis !== 'undefined' && globalThis.navigator ? globalThis.navigator : (typeof navigator !== 'undefined' ? navigator : null);
    if (nav && nav.gpu) {
        try {
            const adapter = await nav.gpu.requestAdapter();
            return !!adapter;
        } catch (e) { return false; }
    }
    return false;
}

export class WebLLMEngine {
    constructor() {
        this.engine = null;
        this.loadPromise = null;
        this.inferenceSemaphore = Promise.resolve();
        this.worker = null;
    }

    async loadModel(modelId, progressCallback, options = {}) {
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = (async () => {
            try {
                const webLLM = await import("https://esm.run/@mlc-ai/web-llm");
                
                const engineConfig = {
                    initProgressCallback: progressCallback,
                    logLevel: "warn",
                };
                
                // 安定動作のための推奨設定
                const chatOpts = {
                    context_window_size: 1024,
                    temperature: 0.7,
                };

                console.log("[Engine] Initializing with Web Worker...");
                this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
                this.engine = await webLLM.CreateWebWorkerMLCEngine(
                    this.worker,
                    modelId,
                    engineConfig,
                    chatOpts
                );
                
                console.log("[Engine] Model loaded successfully.");
                return true;
            } catch (e) {
                console.error("[Engine] Failed to load model:", e);
                this.loadPromise = null;
                throw e;
            }
        })();
        return this.loadPromise;
    }

    async getRecommendations(query, layers) {
        // セマフォの代わりに、単純なシーケンシャル実行を実現する
        return new Promise((resolve, reject) => {
            this.inferenceSemaphore = this.inferenceSemaphore.then(async () => {
                try {
                    if (this.loadPromise) await this.loadPromise;
                    if (!this.engine) throw new Error("Engine not ready.");

                    // 負荷軽減のためのわずかな遅延
                    await new Promise(r => setTimeout(r, 100));

                    let content = "";
                    if (layers && layers.length > 0) {
                        // 文字数制限を考慮し、候補数を減らしてプロンプトを短縮
                        const layersStr = layers.slice(0, 30).map(l => l.name).join(', ');
                        content = `クエリ:${query}\nレイヤー候補:${layersStr}\n関連するレイヤー名を最大3つ挙げ、理由を短く書いてください。\n【ルール】候補以外の名前は絶対に出力しないこと。候補がない場合は「候補なし」とだけ出力すること。`;
                    } else {
                        content = query;
                    }

                    const result = await this.engine.chat.completions.create({ 
                        messages: [{ role: "user", content }],
                        temperature: 0.1,
                        max_tokens: 128 // 応答を十分に長く確保
                    });
                    
                    const reply = result.choices[0].message.content;
                    
                    if (layers && layers.length > 0) {
                        resolve(this._parseSimpleResponse(reply, layers));
                    } else {
                        resolve(reply);
                    }
                } catch (e) {
                    console.error("[Engine] Inference error:", e);
                    reject(new Error(e instanceof Error ? e.message : String(e)));
                }
            });
        });
    }

    /**
     * AIの自由回答からレイヤー名を探し出す
     */
    _parseSimpleResponse(text, availableLayers) {
        // AIの返答をデバッグ出力
        console.log("[Engine] AI Raw Response:", text);

        if (text.includes("候補なし")) {
            return [{ name: "候補なし", reason: "AIが推奨なしと判断しました。" }];
        }
        
        const found = [];
        // 検索範囲を全レイヤーに広げ、一致するものを探す
        for (const layer of availableLayers) {
            if (text.includes(layer.name)) {
                found.push({ name: layer.name, reason: text });
            }
        }
        
        if (found.length === 0) {
            return [{ name: "候補なし", reason: "マッチするレイヤーが見つかりませんでした。" }];
        }
        return found;
    }
}
