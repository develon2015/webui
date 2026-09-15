/**
 * 拖动元素组合式函数
 * 按住句柄拖动目标元素：指针位移换算为元素偏移，并自动钳制在视口边界内
 * 适用于面板、浮窗等 fixed 定位元素的拖动场景
 */
import { onBeforeUnmount, reactive, ref, type Ref } from 'vue'

export interface UseDragMoveOptions {
    /** 拖动的目标元素（偏移最终应用在该元素的 transform 上） */
    target: Ref<HTMLElement | undefined>
    /** 拖动开关：返回 false 时忽略本次按下（如面板设置 draggable=false） */
    enabled?: () => boolean
    /** 按下起点过滤：返回 true 时忽略本次按下（如起点落在操作按钮上） */
    ignore?: (e: PointerEvent) => boolean
    /** 拖动开始回调（如将面板提到最顶层） */
    onDragStart?: (e: PointerEvent) => void
}

export function useDragMove(options: UseDragMoveOptions) {
  // 拖动累计位移（由调用方应用到目标元素的 transform 上）
  const offset = reactive({ x: 0, y: 0 })
  // 拖动期间设为 'transform'，提示浏览器加速
  const willChange = ref('')

  let dragging = false // 是否正在拖动
  let [startX, startY, startOffsetX, startOffsetY] = [0, 0, 0, 0] // 按下时的指针坐标与位移快照
  let [minOffsetX, maxOffsetX, minOffsetY, maxOffsetY] = [0, 0, 0, 0] // 位移边界（保证元素不出视口）

  // 将数值限制在 [min, max] 区间内
  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max)
  }

  // 拖动中：按指针位移更新元素偏移，并钳制在视口边界内
  function onPointerMove(e: PointerEvent) {
    if (!dragging) return
    offset.x = clamp(startOffsetX + (e.clientX - startX), minOffsetX, maxOffsetX)
    offset.y = clamp(startOffsetY + (e.clientY - startY), minOffsetY, maxOffsetY)
  }

  // 结束拖动：还原状态并移除全局事件监听
  function onPointerUp() {
    dragging = false
    willChange.value = ''
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
    document.removeEventListener('pointercancel', onPointerUp)
    document.body.style.userSelect = ''
  }

  // 按下句柄开始拖动（Pointer Events 同时兼容鼠标与触摸）
  function onHandlePointerDown(e: PointerEvent) {
    if (options.enabled && !options.enabled()) return
    // 起点被过滤（如落在操作按钮上）时不触发拖动
    if (options.ignore?.(e)) return

    const el = options.target.value
    if (!el) return

    options.onDragStart?.(e)
    willChange.value = 'transform'

    // 根据元素当前位置与视口尺寸，计算本次拖动的偏移范围，防止元素拖出视口
    const rect = el.getBoundingClientRect()
    const baseLeft = rect.left - offset.x
    const baseTop = rect.top - offset.y
    minOffsetX = -baseLeft
    maxOffsetX = window.innerWidth - rect.width - baseLeft
    minOffsetY = -baseTop
    maxOffsetY = window.innerHeight - rect.height - baseTop
    // 元素尺寸超出视口时，取值区间会倒置，统一交换保证 clamp 有效
    ;[minOffsetX, maxOffsetX] = [Math.min(minOffsetX, maxOffsetX), Math.max(minOffsetX, maxOffsetX)]
    ;[minOffsetY, maxOffsetY] = [Math.min(minOffsetY, maxOffsetY), Math.max(minOffsetY, maxOffsetY)]

    dragging = true
    ;[startX, startY, startOffsetX, startOffsetY] = [e.clientX, e.clientY, offset.x, offset.y]
    // 拖动期间禁止选中文本；监听挂到 document 上，指针移出元素也能继续拖动
    document.body.style.userSelect = 'none'
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerUp)
  }

  // 卸载前移除拖动事件监听
  onBeforeUnmount(onPointerUp)

  return { offset, willChange, onHandlePointerDown }
}
