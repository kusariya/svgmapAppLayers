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
                    context_window_size: 512,
                    temperature: 0.2,
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
                        const layersStr = layers.map(l => `- ${l.name}`).join('\n');
                        content = `Select up to 3 layers from the list below:
${layersStr}

Query: "${query}"

Answer in Japanese in this format:
1. LayerName: Reason
`;
                    } else {
                        content = query;
                    }


                    // クエリごとのコンテキストを完全にリセットするため、messagesを毎回新規作成
                    const result = await this.engine.chat.completions.create({ 
                        messages: [{ role: "user", content }], 
                        temperature: 0.5, 
                        repetition_penalty: 1.2,
                        max_tokens: 128
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

        // プロンプトの復唱をカット（セパレーター以降を取り出す）
        let answerText = text;
        const separators = ["### Response (Japanese)", "### 回答", "Response:"];
        let foundSeparator = false;
        
        for (const sep of separators) {
            if (text.includes(sep)) {
                answerText = text.split(sep).pop();
                foundSeparator = true;
                break;
            }
        }
        
        // セパレーターが見つからず、プロンプトが含まれている場合は、復唱とみなして空にする
        if (!foundSeparator && (text.includes("Task:") || text.includes("Candidates:"))) {
            answerText = "";
        }

        // 行頭が "1. " で始まっていない場合（プロンプトで補完を促しているため）、補完する
        if (answerText.trim().length > 0 && !answerText.trim().match(/^\d+[\.\s]/)) {
            answerText = "1. " + answerText.trim();
        }

        if (answerText.includes("候補なし") || answerText.trim() === "") {
            return [{ name: "候補なし", reason: "AIが推奨なしと判断しました。" }];
        }
        
        const found = [];
        const lines = answerText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        // 行頭が数字で始まり、コロンが含まれる行からレイヤー名と理由を抽出
        for (const line of lines) {
            // コロンがあってもなくても抽出できるように調整
            const match = line.match(/^\d+[\.\s]+([^:：]+)(?:[:：]\s*(.*))?$/);
            if (match) {
                const potentialName = match[1].trim();
                const reason = match[2] ? match[2].trim() : "AIが推奨したレイヤーです。";

                // 完全一致または前方一致でレイヤーを特定
                const layer = availableLayers.find(l => 
                    l.name === potentialName || 
                    potentialName.includes(l.name) || 
                    l.name.includes(potentialName)
                );

                if (layer && !found.find(f => f.name === layer.name)) {
                    found.push({ name: layer.name, reason: reason });
                }
            }
        }
        // 形式で見つからなかった場合のフォールバック
        if (found.length === 0) {
            for (const layer of availableLayers) {
                if (answerText.includes(layer.name)) {
                    if (found.length < 3 && !found.find(f => f.name === layer.name)) {
                        found.push({ name: layer.name, reason: "AIが推奨したレイヤーです。" });
                    }
                }
            }
        }
        
        if (found.length === 0) {
            return [{ name: "候補なし", reason: "マッチするレイヤーが見つかりませんでした。" }];
        }
        return found;
    }
}
