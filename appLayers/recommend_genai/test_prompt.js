// test_prompt.js
import assert from 'node:assert';
import { WebLLMEngine } from './engine.js';

async function testPromptAndParsing() {
    console.log("Testing Prompt Generation and Response Parsing...");

    const engine = new WebLLMEngine();
    const mockLayers = [
        { name: "避難所", category: "災害" },
        { name: "雨雲レーダー", category: "気象" }
    ];
    const query = "雨が心配です";

    // 1. プロンプト生成のテスト
    const prompt = engine._buildPrompt(query, mockLayers);
    assert.ok(prompt.includes(query), "プロンプトにユーザーのクエリが含まれていること");
    assert.ok(prompt.includes("避難所"), "プロンプトにレイヤー名が含まれていること");
    assert.ok(prompt.includes("JSON"), "プロンプトに出力形式の指定が含まれていること");

    // 2. レスポンス解析のテスト
    const mockLlmResponse = `
    推奨するレイヤーは以下の通りです。
    \`\`\`json
    [
        { "name": "雨雲レーダー", "reason": "現在の雨の状況をリアルタイムで確認できます。" },
        { "name": "捏造レイヤー", "reason": "これは存在しないはずです。" }
    ]
    \`\`\`
    `;

    const recommendations = engine._parseResponse(mockLlmResponse, mockLayers);
    
    assert.strictEqual(recommendations.length, 1, "実在するレイヤーのみが抽出されること");
    assert.strictEqual(recommendations[0].name, "雨雲レーダー");
    assert.ok(recommendations[0].reason.includes("リアルタイム"), "推奨理由が正しく保持されていること");

    console.log("✅ Prompt & Parsing Test - Passed");
}

(async () => {
    try {
        await testPromptAndParsing();
    } catch (e) {
        console.error("❌ Prompt & Parsing Test - Failed");
        console.error(e);
        process.exit(1);
    }
})();
