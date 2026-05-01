// analyzer.js

/**
 * ユーザーが指定した getRootLayersProps() を取得する
 */
function getRootLayersProps() {
    if (typeof svgMap !== 'undefined' && svgMap.getRootLayersProps()) {
        return svgMap.getRootLayersProps();
    }
    return [];
}

/**
 * 地図から全レイヤーの定義を取得する（フィルタリングなし）
 * @returns {Array<{name: string, category: string}>}
 */
export function getAllLayerDefinitions() {
    const props = getRootLayersProps();
    const layers = [];

    props.forEach(p => {
        const title = p.title;
        const className = p.className || p.class || "";
        const groupName = p.groupName || p.category || ""; // categoryプロパティもチェック
        
        if (groupName === "basemap" || className.includes("basemap")) return;
        if (!title) return;

        // カテゴリのクレンジング: classNameやgroupNameから抽出
        let rawCat = groupName || className;
        let cleanCategory = rawCat.replace(/(clickable|editable|switch|batch|visibility|hidden)/g, '').trim().replace(/\s+/g, ' '); 
        
        layers.push({
            name: title,
            category: cleanCategory || "その他"
        });
    });

    return layers;
}

/**
 * クエリに基づきレイヤーの関連度を計算し、上位を抽出する（RAG/Retrievalロジック）
 * @param {string} query ユーザーの入力
 * @param {Array} layers 全レイヤーリスト
 * @param {number} limit 抽出件数（デフォルト15）
 */
export function scoreLayers(query, layers, limit = 15) {
    if (!query || query.trim().length === 0) {
        return layers.slice(0, limit).map(l => ({ ...l, relevance: 0 }));
    }

    const normalizedQuery = query.toLowerCase();
    
    // 1. 基本的なキーワード分割
    let keywords = normalizedQuery.split(/[\s,，、。．.!！?？]+/).filter(k => k.length > 0);
    
    // 2. 日本語（マルチバイト）の場合、2文字ずつのN-gramを追加して部分一致を強化
    const ngrams = [];
    keywords.forEach(k => {
        if (k.length >= 2 && /[^\x00-\x7F]/.test(k)) {
            for (let i = 0; i < k.length - 1; i++) {
                ngrams.push(k.substring(i, i + 2));
            }
        }
    });
    keywords = [...new Set([...keywords, ...ngrams])];
    
    const scored = layers.map(l => {
        let score = 0;
        const name = l.name.toLowerCase();
        const cat = l.category.toLowerCase();
        
        keywords.forEach(k => {
            // 完全一致
            if (name === k) {
                score += 20;
            } 
            // 名前がキーワードに含まれる、またはその逆（双方向の部分一致）
            else if (name.includes(k) || k.includes(name)) {
                score += (k.length >= 2) ? 10 : 2;
            }
            
            // カテゴリへの一致
            if (cat !== "その他" && (cat.includes(k) || k.includes(cat))) {
                score += 5;
            }
        });
        return { ...l, relevance: score };
    });

    // スコア順にソートし、上位を抽出。さらにスコアが0のものは除外する。
    return scored
        .filter(l => l.relevance > 0)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);
}

/**
 * レイヤー情報を抽出し、LLMが理解しやすい形式に変換する。
 * クエリが指定された場合、キーワードマッチングによる事前フィルタリング（RAG）を行う。
 * 
 * @param {string} [query] - ユーザーの入力クエリ
 * @returns {Array<{name: string, category: string, relevance?: number}>}
 */
export function getAvailableLayers(query) {
    const allLayers = getAllLayerDefinitions();
    console.log("[Analyzer] Total available layers:", allLayers.length);
    
    const filtered = scoreLayers(query, allLayers);
    console.log("[Analyzer] Filtered layers count:", filtered.length);
    if (query) {
        console.log("[Analyzer] Top filtered layer:", filtered[0]);
    }
    
    return filtered;
}

// ブラウザ環境でのデバッグ用にグローバルに公開
if (typeof window !== 'undefined') {
    window.getAvailableLayers = getAvailableLayers;
    window.getAllLayerDefinitions = getAllLayerDefinitions;
    window.scoreLayers = scoreLayers;
}
