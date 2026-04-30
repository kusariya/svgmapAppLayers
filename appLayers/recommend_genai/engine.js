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
    }

    async loadModel(modelId, progressCallback) {
        if (this.loadPromise) return this.loadPromise;
        this.loadPromise = (async () => {
            try {
                const { MLCEngine } = await import("https://esm.run/@mlc-ai/web-llm");
                const engine = new MLCEngine();
                engine.setInitProgressCallback((report) => {
                    if (progressCallback) progressCallback(report);
                });
                await engine.reload(modelId, {
                    context_window_size: 512, // testが動いた設定を維持
                    low_gpu_mem_usage_mode: true
                });
                this.engine = engine;
                return true;
            } catch (e) {
                this.loadPromise = null;
                throw e;
            }
        })();
        return this.loadPromise;
    }

    async getRecommendations(query, layers) {
        const currentTask = this.inferenceSemaphore.then(async () => {
            if (this.loadPromise) await this.loadPromise;
            if (!this.engine) throw new Error("Engine not ready.");

            let content = "";
            if (layers && layers.length > 0) {
                // 上位15件に絞り、シンプルな命令にする
                const layersStr = layers.slice(0, 15).map(l => l.name).join(', ');
                content = `質問:${query}\n候補:${layersStr}\n最適なレイヤー名を1つだけ挙げ、理由を短く添えてください。`;
            } else {
                content = query;
            }

            try {
                const result = await this.engine.chat.completions.create({ 
                    messages: [{ role: "user", content }],
                    temperature: 0.1,
                    max_tokens: 100 // 回答を短くして負荷を抑える
                });
                const reply = result.choices[0].message.content;
                
                if (layers && layers.length > 0) {
                    return this._parseSimpleResponse(reply, layers);
                }
                return reply;
            } catch (e) {
                throw new Error(e instanceof Error ? e.message : String(e));
            }
        });
        this.inferenceSemaphore = currentTask.then(() => {}, () => {});
        return currentTask;
    }

    /**
     * AIの自由回答からレイヤー名を探し出す
     */
    _parseSimpleResponse(text, availableLayers) {
        const found = [];
        for (const layer of availableLayers.slice(0, 15)) {
            if (text.includes(layer.name)) {
                found.push({ name: layer.name, reason: text });
                break; // 1つ見つかればOK
            }
        }
        // 見つからない場合は自由回答をそのまま表示
        if (found.length === 0) {
            return [{ name: "AIの提案", reason: text }];
        }
        return found;
    }
}
