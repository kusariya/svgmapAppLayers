// worker.js
// WebLLM Worker Handler

import { WebWorkerMLCEngineHandler } from "https://esm.run/@mlc-ai/web-llm";

/**
 * Worker内でエンジンの初期化とメッセージハンドリングを行う
 */
try {
    const handler = new WebWorkerMLCEngineHandler();
    self.onmessage = (msg) => {
        handler.onmessage(msg);
    };
    console.log("WebLLM Worker Handler initialized and listening");
} catch (e) {
    if (typeof self !== 'undefined') {
        console.error("Worker initialization failed:", e);
    }
}
