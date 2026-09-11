/**
 * 全局层叠顺序（z-index）管理
 * 多个面板实例共享同一个自增计数器，保证它们之间的遮挡关系始终正确
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useZIndexStore = defineStore("z-index", () => {
    // 当前全局最大 z-index
    const zIndex = ref(0)

    /**
     * 自增并返回一个新的 z-index
     * 调用方拿到返回值后即成为最顶层
     */
    function tapZIndex() {
        return ++zIndex.value
    }

    return { zIndex, tapZIndex }
})
