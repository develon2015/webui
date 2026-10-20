/**
 * 调整元素尺寸组合式函数
 * 按住目标元素边缘 / 四角的手柄拖动即可调整宽高（Pointer Events 同时兼容鼠标与触摸）：
 * - 尺寸通过 onResize 回调输出（钳制后的像素值），由调用方写入样式（与窗口排列共用同一尺寸通道）
 * - 拖西 / 北边缘时通过 translateBy 平移补偿，保持对侧（右 / 下）边缘不动（类 Windows 行为）
 * - 开始调整时调用 beginScreenSpaceMove 固定外部 transform，
 *   使尺寸变化期间元素视觉左上角不受外部 -50% 类位移的缩放效应影响
 */
import { onBeforeUnmount, type Ref } from 'vue'

// 手柄方向：n / s / e / w 四条边 + 四个角
export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export interface UseDragResizeOptions {
    /** 调整的目标元素（尺寸变化作用在该元素上） */
    target: Ref<HTMLElement | undefined>
    /** 调整开关（如面板设置 resizable=false 时禁用） */
    enabled?: () => boolean
    /** 最小宽度 / 高度（像素），拖动越界时钳制 */
    minWidth?: number
    minHeight?: number
    /** 开始调整时固定外部 transform（配合 useDragMove 的位移状态） */
    beginScreenSpaceMove: () => void
    /** 平移元素位置（西 / 北边缘调整时补偿，保持对侧边缘不动） */
    translateBy: (dx: number, dy: number) => void
    /** 尺寸变化回调（每次 pointermove 触发；width / height 为钳制后的像素值） */
    onResize?: (width: number, height: number) => void
}

export function useDragResize(options: UseDragResizeOptions) {
    // 当前拖动的手柄方向与按下时的指针 / 尺寸快照
    let direction: ResizeDirection | null = null
    let [startX, startY, startW, startH] = [0, 0, 0, 0]
    // 已累计的位置补偿量（translateBy 是累加接口，每次只补偿本轮增量）
    let appliedShiftX = 0
    let appliedShiftY = 0

    // 按下手柄开始调整（仅左键）
    function onHandlePointerDown(e: PointerEvent, dir: ResizeDirection) {
        if (e.button !== 0) return
        if (options.enabled && !options.enabled()) return
        const el = options.target.value
        if (!el) return
        const rect = el.getBoundingClientRect()
        // 元素尚未渲染（如仍处于最小化隐藏状态）时跳过
        if (rect.width === 0 && rect.height === 0) return
        direction = dir
        ;[startX, startY, startW, startH] = [e.clientX, e.clientY, rect.width, rect.height]
        appliedShiftX = 0
        appliedShiftY = 0
        // 固定外部 transform：尺寸变化只改宽高像素，视觉左上角位置保持稳定
        options.beginScreenSpaceMove()
        // 调整期间禁止选中文本；监听挂到 document 上，指针移出手柄也能继续调整
        document.body.style.userSelect = 'none'
        document.addEventListener('pointermove', onPointerMove)
        document.addEventListener('pointerup', onPointerUp)
        document.addEventListener('pointercancel', onPointerUp)
    }

    // 拖动中：按手柄方向换算新宽高并钳制最小值；西 / 北方向平移补偿
    function onPointerMove(e: PointerEvent) {
        if (!direction) return
        const minW = options.minWidth ?? 0
        const minH = options.minHeight ?? 0
        const dx = e.clientX - startX
        const dy = e.clientY - startY
        let width = startW
        let height = startH
        let totalShiftX = 0
        let totalShiftY = 0
        if (direction.includes('e')) width = Math.max(startW + dx, minW)
        if (direction.includes('s')) height = Math.max(startH + dy, minH)
        // 西 / 北边缘：对侧（右 / 下）边缘保持不动，需要平移元素；
        // translateBy 是累加接口，这里只补偿相对上一轮的增量（钳制后总补偿不变，增量归零，避免持续漂移）
        if (direction.includes('w')) {
            width = Math.max(startW - dx, minW)
            totalShiftX = startW - width
        }
        if (direction.includes('n')) {
            height = Math.max(startH - dy, minH)
            totalShiftY = startH - height
        }
        options.translateBy(totalShiftX - appliedShiftX, totalShiftY - appliedShiftY)
        appliedShiftX = totalShiftX
        appliedShiftY = totalShiftY
        options.onResize?.(width, height)
    }

    // 结束调整：清理状态并移除全局监听
    function onPointerUp() {
        direction = null
        document.body.style.userSelect = ''
        document.removeEventListener('pointermove', onPointerMove)
        document.removeEventListener('pointerup', onPointerUp)
        document.removeEventListener('pointercancel', onPointerUp)
    }

    // 卸载前移除事件监听
    onBeforeUnmount(onPointerUp)

    return { onHandlePointerDown }
}
