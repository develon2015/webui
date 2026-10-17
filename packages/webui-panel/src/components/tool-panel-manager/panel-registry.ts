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
    /** 返回面板图标（getter 形式；空字符串表示使用默认色块图标） */
    icon: () => string
    /** 返回面板是否处于最小化状态 */
    minimized: () => boolean
    /** 返回父面板 id（getter 形式，读取时仍保持响应式；0 表示无父级），层级连线据此绘制 */
    parentId: () => number
    /** 返回面板根元素，层级连线绘制据此取几何信息 */
    el: () => HTMLElement | undefined
    /** 将面板置顶 */
    tapZIndex: () => void
    /** 高亮显示面板 */
    highlight: (value: boolean) => void
    /** 最小化面板 */
    minimize: () => void
    /** 还原面板（取消最小化并置顶） */
    restore: () => void
    /** 将面板移动到视口中心并置顶 */
    center: () => void
    /** 关闭面板 */
    close: () => void
}

export const usePanelRegistryStore = defineStore('tool-panel-registry', () => {
    // 面板 id 发号器
    let nextId = 1
    // 当前置顶面板的 id，0 表示暂无
    const activeId = ref(0)
    // 已登记的面板条目（任务栏数据源）
    const panels = ref<PanelEntry[]>([])
    // 面板布局版本号：面板几何变化（拖动 / 还原 / 居中）时自增，层级连线组件据此感知重绘
    const layoutTick = ref(0)

    /** 通知面板几何发生变化（面板拖动、还原、居中等场景调用） */
    function bumpLayout() {
        layoutTick.value++
    }

    /** 注册面板实例，返回分配的面板 id */
    function register(entry: Omit<PanelEntry, 'id'>) {
        const id = nextId++
        panels.value.push({ ...entry, id })
        // 后注册的面板初始 z-index 更高，视为置顶
        setActive(id)
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
        // 取消高亮之前置顶的面板
        panels.value.find(panel => panel.id === activeId.value)?.highlight(false)
        // 高亮显示最新置顶的面板
        panels.value.find(panel => panel.id === id)?.highlight(true)
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

    /** 最小化指定面板（任务栏点击激活面板或右键菜单"最小化窗口"时调用） */
    function minimizePanel(id: number) {
        panels.value.find(panel => panel.id === id)?.minimize()
    }

    /** 还原指定面板（任务栏点击已最小化面板或右键菜单"还原窗口"时调用） */
    function restorePanel(id: number) {
        panels.value.find(panel => panel.id === id)?.restore()
    }

    /** 居中指定面板（右键菜单"居中显示"时调用） */
    function centerPanel(id: number) {
        panels.value.find(panel => panel.id === id)?.center()
    }

    /** 把面板移动到指定下标（toIndex 相对于"移除该面板后"的剩余列表） */
    function movePanel(id: number, toIndex: number) {
        const from = panels.value.findIndex(panel => panel.id === id)
        if (from < 0) return
        const [moved] = panels.value.splice(from, 1)
        if (!moved) return
        panels.value.splice(Math.min(Math.max(toIndex, 0), panels.value.length), 0, moved)
    }

    return { activeId, panels, layoutTick, register, unregister, setActive, tapPanel, closePanel, minimizePanel, restorePanel, centerPanel, movePanel, bumpLayout }
})
