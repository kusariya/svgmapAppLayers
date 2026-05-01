// analyzer.js
// Synonym-based Semantic Search (Lightweight)

let synonymCache = null;

async function loadSynonyms() {
    if (synonymCache) return synonymCache;
    try {
        const response = await fetch('./synonyms.json');
        synonymCache = await response.json();
        console.log("[Analyzer] Synonyms loaded.");
        return synonymCache;
    } catch (e) {
        console.error("[Analyzer] Failed to load synonyms:", e);
        synonymCache = {};
        return synonymCache;
    }
}

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
 * 地図から全レイヤーの定義を取得する
 */
export function getAllLayerDefinitions() {
    const props = getRootLayersProps();
    const layers = [];

    props.forEach(p => {
        const title = p.title;
        const className = p.className || p.class || "";
        const groupName = p.groupName || p.category || "";
        
        if (groupName === "basemap" || className.includes("basemap")) return;
        if (!title) return;

        let rawCat = groupName || className;
        let cleanCategory = rawCat.replace(/(clickable|editable|switch|batch|visibility|hidden)/g, '').trim().replace(/\s+/g, ' '); 
        
        layers.push({
            name: title,
            category: cleanCategory || "その他",
            searchText: `${title} ${cleanCategory || "その他"}`
        });
    });

    return layers;
}

/**
 * 同義語展開とキーワードマッチングによるスコアリング
 */
export async function scoreLayers(query, layers, limit = 15) {
    if (!query || query.trim().length === 0) {
        return layers.slice(0, limit).map(l => ({ ...l, relevance: 0 }));
    }

    const synonyms = await loadSynonyms();
    const normalizedQuery = query.toLowerCase();

    // 1. キーワード抽出とシノニム展開
    const queryKeywords = normalizedQuery.match(/[\u4e00-\u9faf]+|[\u30a0-\u30ff]+|[a-z0-9]+/g) || [normalizedQuery];
    let searchTokens = new Set(queryKeywords);
    queryKeywords.forEach(kw => {
        if (synonyms[kw]) synonyms[kw].forEach(s => searchTokens.add(s));
    });

    // 2. スコアリング
    const scored = layers.map(l => {
        let score = 0;
        const name = l.name.toLowerCase();
        const searchText = l.searchText.toLowerCase();

        searchTokens.forEach(token => {
            if (name === token) score += 100;           // 完全一致は圧倒的に優先
            else if (searchText.includes(token)) score += 20; // 関連テキスト内の出現
            else if (token.includes(name)) score += 10;      // 逆包含
        });


        return { ...l, relevance: score };
    });

    // 3. フィルタリングとソート
    // relevance > 0 のものがなければ、全レイヤーをスコア順で返す（空リストを避ける）
    const filtered = scored.filter(l => l.relevance > 0);
    const result = filtered.length > 0 ? filtered : scored;
    
    return result
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);
}

/**
 * 公開API
 */
export async function getAvailableLayers(query) {
    const allLayers = getAllLayerDefinitions();
    return await scoreLayers(query, allLayers);
}

// グローバル公開
if (typeof window !== 'undefined') {
    window.getAvailableLayers = getAvailableLayers;
}
