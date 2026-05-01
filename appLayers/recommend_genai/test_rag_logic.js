
import { scoreLayers } from './analyzer.js';

// Node.js環境で実行する場合のモック（ブラウザ環境での実行を想定）
const mockLayers = [
    { name: '洪水浸水想定区域(一次メッシュ)　2023 想定最大規模', category: '災害' },
    { name: '避難所', category: '施設' },
    { name: 'バスルート', category: '交通' },
    { name: 'ヘリポート', category: '施設' },
    { name: '地価公示データ2017年', category: '統計' },
    { name: '歯科診療所', category: '医療' },
    { name: '診療所(一般)', category: '医療' },
    { name: '病院', category: '医療' }
];

async function runTest(query) {
    console.log(`\n--- Testing Semantic Query: "${query}" ---`);
    try {
        const results = await scoreLayers(query, mockLayers, 3);
        results.forEach((r, i) => {
            console.log(`${i+1}. ${r.name} (Relevance: ${r.relevance.toFixed(4)}, Cat: ${r.category})`);
        });
    } catch (e) {
        console.error("Test failed:", e);
    }
}

async function main() {
    console.log("Starting Semantic RAG Test...");
    await runTest("雨雲の動きや台風の進路が知りたい");
    await runTest("避難場所を確認したい");
    await runTest("病院や診療所を探す");
    await runTest("doctor"); // 英語クエリでもヒットするか
    console.log("\nTest completed.");
}

main();
