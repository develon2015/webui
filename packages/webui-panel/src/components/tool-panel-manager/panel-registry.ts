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
    /** 将面板排列到指定矩形（x/y 为视口坐标，width/height 省略时保持当前尺寸） */
    arrange: (rect: { x: number, y: number, width?: number, height?: number }) => void
    /** 关闭面板 */
    close: () => void
}

/** 视口工作区（扣除任务栏后的可排列区域） */
export interface WorkArea {
    x: number
    y: number
    width: number
    height: number
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

    /** 未最小化的面板列表（窗口排列只作用于可见窗口） */
    function visiblePanels() {
        return panels.value.filter(panel => !panel.minimized())
    }

    /** 层叠所有未最小化面板（任务栏菜单"层叠窗口"）：沿右下依次偏移，尺寸保持不变，超出工作区后回绕 */
    function cascadePanels(area: WorkArea) {
        const step = 30
        let x = area.x + 16
        let y = area.y + 16
        visiblePanels().forEach((panel) => {
            panel.arrange({ x, y })
            x += step
            y += step
            // 右下方向容不下一个最小尺寸面板（约 240x120）时回到工作区起点继续层叠
            if (x + 240 > area.x + area.width || y + 120 > area.y + area.height) {
                x = area.x + 16
                y = area.y + 16
            }
        })
    }

    /** 未最小化面板及其当前尺寸（平铺按实际窗口大小计算，跳过读不到矩形的面板） */
    function visibleSizes() {
        const items: { panel: PanelEntry, width: number, height: number }[] = []
        for (const panel of visiblePanels()) {
            const rect = panel.el()?.getBoundingClientRect()
            if (rect && rect.width > 0 && rect.height > 0) {
                items.push({ panel, width: rect.width, height: rect.height })
            }
        }
        return items
    }

    /** 堆叠显示所有未最小化面板（任务栏菜单"堆叠显示窗口"）：尺寸不变，按实际窗口大小沿纵向平铺 */
    function stackPanels(area: WorkArea) {
        tilePanels(area, true)
    }

    /** 并排显示所有未最小化面板（任务栏菜单"并排显示窗口"）：尺寸不变，按实际窗口大小沿横向平铺 */
    function sideBySidePanels(area: WorkArea) {
        tilePanels(area, false)
    }

    /** 沿单一方向平铺窗口（vertical=true 纵向堆叠 / false 横向并排）：
     *  窗口尺寸保持不变；主轴剩余空间均分为间隙（不足时间距为负，窗口均匀重叠恰好填满工区），
     *  交叉方向在工区内居中 */
    function tilePanels(area: WorkArea, vertical: boolean) {
        const items = visibleSizes()
        const count = items.length
        if (!count) return
        const total = items.reduce((sum, item) => sum + (vertical ? item.height : item.width), 0)
        const extent = vertical ? area.height : area.width
        const free = extent - total
        // 富余：按 count+1 份均分（首尾各留一份）；不足：按 count-1 份均分为负间距
        const gap = free >= 0 ? free / (count + 1) : count > 1 ? free / (count - 1) : 0
        const origin = vertical ? area.y : area.x
        let pos = origin + (free >= 0 ? gap : 0)
        for (const item of items) {
            const crossOffset = vertical
                ? Math.max((area.width - item.width) / 2, 0)
                : Math.max((area.height - item.height) / 2, 0)
            const rect = vertical
                ? { x: area.x + crossOffset, y: pos }
                : { x: pos, y: area.y + crossOffset }
            item.panel.arrange(rect)
            pos += (vertical ? item.height : item.width) + gap
        }
    }

    /** 最小化全部面板 */
    function minimizeAllPanels() {
        panels.value.forEach(panel => panel.minimize())
    }

    /** 关闭全部面板 */
    function closeAllPanels() {
        // 快照遍历：close 会触发面板卸载并同步注销，修改 panels 数组
        ;[...panels.value].forEach(panel => panel.close())
    }

    return { activeId, panels, layoutTick, register, unregister, setActive, tapPanel, closePanel, minimizePanel, restorePanel, centerPanel, movePanel, cascadePanels, stackPanels, sideBySidePanels, minimizeAllPanels, closeAllPanels, bumpLayout }
})
