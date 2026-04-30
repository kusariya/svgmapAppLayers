// test_engine.js
// 簡易的なテストスクリプト

console.log("Node version:", process.version);
console.log("Global navigator exists:", typeof navigator !== 'undefined');

const mockNavigator = {
    gpu: {
        requestAdapter: async () => ({})
    }
};

async function testWebGPUSupport(checkFunc) {
    console.log("Testing WebGPU Support Detection...");
    
    // WebGPUがある場合
    try {
        Object.defineProperty(globalThis, 'navigator', {
            value: mockNavigator,
            writable: true,
            configurable: true
        });
    } catch (e) {
        console.log("Could not redefine navigator, trying to patch existing one");
        Object.assign(globalThis.navigator, mockNavigator);
    }
    
    const supported = await checkFunc();
    console.log("Result for 'Available':", supported);
    if (supported === true) {
        console.log("✅ Case: WebGPU Available - Passed");
    } else {
        console.error("❌ Case: WebGPU Available - Failed");
        process.exit(1);
    }

    // WebGPUがない場合
    global.navigator = {};
    const notSupported = await checkFunc();
    if (notSupported === false) {
        console.log("✅ Case: WebGPU Missing - Passed");
    } else {
        console.error("❌ Case: WebGPU Missing - Failed");
        process.exit(1);
    }
}

// 実行
(async () => {
    try {
        const { checkWebGPUSupport } = await import('./engine.js');
        await testWebGPUSupport(checkWebGPUSupport);
        console.log("\nAll foundation tests passed!");
    } catch (e) {
        console.error("Test execution failed:", e);
        process.exit(1);
    }
})();
