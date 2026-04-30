// analyzer.js

/**
 * ユーザーが指定した getRootLayersProps() を取得する
 * @returns {layerid: Array<{id: string, number: number, title: string, visible: boolean}>, layerid: Array<{id: string, number: number, title: string, visible: boolean}>, ...}
 */
export function getRootLayersProps() {
    if (typeof svgMap !== 'undefined' && svgMap.getRootLayersProps()) {
        return svgMap.getRootLayersProps();
    }
    return [];
}

/**
 * レイヤー情報を抽出し、LLMが理解しやすい形式に変換する
 * @returns {Array<{name: string, category: string}>}
 */
export function getAvailableLayers() {
    const props = getRootLayersProps();
    const layers = [];
    console.log("Root Layers Props:", props); // デバッグ用ログ

    props.forEach(p => {
        const title = p.title;
        // SVGの属性名（className）またはプロパティ名を確認
        const className = p.className || p.class || "";
        
        // 除外条件: basemap, title空
        if (className.includes("basemap")) return;
        if (!title) return;

        // カテゴリのクレンジング
        // clickable, editable などのメタ情報を除いて純粋なカテゴリ名（災害、気象など）を抽出する
        let cleanCategory = className.replace(/(clickable|editable|switch|batch|visibility|hidden)/g, '').trim().replace(/\s+/g, ' '); 
        
        layers.push({
            name: title,
            category: cleanCategory || "その他"
        });
    });

    return layers;
}

// ブラウザ環境でのデバッグ用にグローバルに公開
if (typeof window !== 'undefined') {
    window.getAvailableLayers = getAvailableLayers;
}
