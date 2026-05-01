
import { scoreLayers } from './analyzer.js';

const mockLayers = [
    { name: '洪水浸水想定区域(一次メッシュ)　2023 想定最大規模', category: '災害 clickable' },
    { name: '避難所', category: '施設 switch' },
    { name: 'バスルート', category: '交通' },
    { name: 'ヘリポート', category: '施設' },
    { name: '地価公示データ2017年', category: '統計' },
    { name: '歯科診療所', category: '医療' },
    { name: '診療所(一般)', category: '医療' },
    { name: '病院', category: '医療' }
];

function test(query) {
    console.log(`\n--- Testing Query: "${query}" ---`);
    const results = scoreLayers(query, mockLayers, 3);
    results.forEach((r, i) => {
        console.log(`${i+1}. ${r.name} (Score: ${r.relevance}, Cat: ${r.category})`);
    });
}

test("雨雲の動きや台風の進路が知りたい"); // 「洪水」がヒットするか
test("避難場所を確認したい"); // 「避難所」がヒットするか
test("病院や診療所を探す"); // 医療系がヒットするか
test(""); // 空クエリ（先頭から返るか）
