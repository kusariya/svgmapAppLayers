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
 * 
 * 仕様: WebLLMからの回答は、必ずここから返されるリストに含まれるレイヤー名のみとすること。
 * 候補がない場合は「候補なし」とすること。
 */
export function getAvailableLayers() {
    const props = getRootLayersProps();
    const layers = [];
    console.log("Root Layers Props:", props); // デバッグ用ログ

    props.forEach(p => {
        const title = p.title;
        // SVGの属性名（className/class）またはプロパティ名を確認
        const className = p.className || p.class || "";
        const groupName = p.groupName || "";
        
        // 除外条件: groupNameが"basemap"であるか、classNameに"basemap"を含む場合
        if (groupName === "basemap" || className.includes("basemap")) return;
        if (!title) return;

        // カテゴリのクレンジング
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
