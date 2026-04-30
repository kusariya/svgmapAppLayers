// test_worker.js
// Web Worker通信のテスト

import assert from 'node:assert';
import { EventEmitter } from 'node:events';

// Workerのモック
class MockWorker extends EventEmitter {
    constructor(url) {
        super();
        this.url = url;
        this.sentMessages = [];
    }
    postMessage(msg) {
        this.sentMessages.push(msg);
        // モック応答: 初期化成功を模す
        if (msg.type === 'init') {
            setTimeout(() => {
                this.emit('message', { data: { type: 'init_complete', modelId: msg.modelId } });
            }, 10);
        }
    }
    addEventListener(type, listener) {
        this.on(type, listener);
    }
}

// globalにWorkerを登録
global.Worker = MockWorker;

async function testWorkerCommunication() {
    console.log("Testing Web Worker Communication...");

    const { WebLLMEngine } = await import('./engine.js');
    const engine = new WebLLMEngine();
    
    // Workerモードでの初期化をテスト
    // 現状のWebLLMEngine.loadModelはWorker対応していないため、ここを修正する
    let progressCaptured = false;
    await engine.loadModel('test-model', (report) => {
        progressCaptured = true;
    }, { useWorker: true });

    const lastMsg = engine.worker.sentMessages[0];
    assert.strictEqual(lastMsg.type, 'init', "Workerにinitメッセージが送信されること");
    assert.strictEqual(lastMsg.modelId, 'test-model', "正しいmodelIdが送信されること");
    
    console.log("✅ Worker Messaging Test - Passed");
}

(async () => {
    try {
        await testWorkerCommunication();
        console.log("\nAll worker tests passed!");
    } catch (e) {
        console.error("Test execution failed:", e);
        process.exit(1);
    }
})();
