import { defineStore } from 'pinia'
import { ref } from 'vue'

// 任务栏面板条目
export interface PanelEntry {
    id: number
    title: () => string
    tapZIndex: () => void
    close: () => void
}

export const usePanelRegistryStore = defineStore('panel-registry', () => {
    let nextId = 1
    // 当前置顶的面板
    const activeId = ref(0)
    const panels = ref<PanelEntry[]>([])

    // 注册面板实例，返回面板 id
    function register(entry: Omit<PanelEntry, 'id'>) {
        const id = nextId++
        panels.value.push({ ...entry, id })
        // 后注册的面板初始 z-index 更高，视为置顶
        activeId.value = id
        return id
    }

    // 注销面板实例
    function unregister(id: number) {
        panels.value = panels.value.filter(panel => panel.id !== id)
        if (activeId.value === id) {
            activeId.value = 0
        }
    }

    function setActive(id: number) {
        activeId.value = id
    }

    // 将面板置顶
    function tapPanel(id: number) {
        panels.value.find(panel => panel.id === id)?.tapZIndex()
    }

    // 关闭面板
    function closePanel(id: number) {
        panels.value.find(panel => panel.id === id)?.close()
    }

    return { activeId, panels, register, unregister, setActive, tapPanel, closePanel }
})
