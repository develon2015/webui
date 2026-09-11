/**
 * 面板注册表
 * ToolPanel 实例挂载时在此登记，ToolPanelManager（任务栏）据此罗列所有面板
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

// 任务栏面板条目
export interface PanelEntry {
    /** 面板唯一标识 */
    id: number
    /** 返回面板标题（getter 形式，读取时仍保持响应式） */
    title: () => string
    /** 将面板置顶 */
    tapZIndex: () => void
    /** 关闭面板 */
    close: () => void
}

export const usePanelRegistryStore = defineStore('panel-registry', () => {
    // 面板 id 发号器
    let nextId = 1
    // 当前置顶面板的 id，0 表示暂无
    const activeId = ref(0)
    // 已登记的面板条目（任务栏数据源）
    const panels = ref<PanelEntry[]>([])

    /** 注册面板实例，返回分配的面板 id */
    function register(entry: Omit<PanelEntry, 'id'>) {
        const id = nextId++
        panels.value.push({ ...entry, id })
        // 后注册的面板初始 z-index 更高，视为置顶
        activeId.value = id
        return id
    }

    /** 注销面板实例（面板关闭或卸载时调用） */
    function unregister(id: number) {
        panels.value = panels.value.filter(panel => panel.id !== id)
        if (activeId.value === id) {
            activeId.value = 0
        }
    }

    /** 标记置顶面板（由面板自身置顶时回调） */
    function setActive(id: number) {
        activeId.value = id
    }

    /** 置顶指定面板（任务栏点击时调用） */
    function tapPanel(id: number) {
        panels.value.find(panel => panel.id === id)?.tapZIndex()
    }

    /** 关闭指定面板（任务栏右键菜单"关闭窗口"时调用） */
    function closePanel(id: number) {
        panels.value.find(panel => panel.id === id)?.close()
    }

    return { activeId, panels, register, unregister, setActive, tapPanel, closePanel }
})
