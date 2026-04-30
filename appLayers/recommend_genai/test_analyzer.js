// test_analyzer.js
import assert from 'node:assert';
import { getAvailableLayers } from './analyzer.js';

function testExtraction() {
    console.log("Testing Layer Extraction from getSvgImageProps...");

    // getSvgImageProps の出力を模倣するモック
    // svgMap.getRootLayersProps() がこれに近いデータを返すと想定
    global.svgMap = {
        getRootLayersProps: () => [
            { id: "L1", title: "Layer 1", className: "category-a clickable" },
            { id: "L2", title: "Layer 2", className: "basemap switch" },
            { id: "L3", title: "Layer 3", className: "category-b batch" },
            { id: "L4", title: "", className: "category-c" },
        ]
    };

    const layers = getAvailableLayers();

    // basemapは除外されるべき
    // titleがないものは除外されるべき
    assert.strictEqual(layers.length, 2, "2つの有効なレイヤーが抽出されること");
    
    assert.strictEqual(layers[0].name, "Layer 1");
    assert.strictEqual(layers[0].category, "category-a");

    assert.strictEqual(layers[1].name, "Layer 3");
    assert.strictEqual(layers[1].category, "category-b");

    console.log("✅ Layer Extraction Test - Passed");
}

try {
    testExtraction();
} catch (e) {
    console.error("❌ Layer Extraction Test - Failed");
    console.error(e);
    process.exit(1);
}
