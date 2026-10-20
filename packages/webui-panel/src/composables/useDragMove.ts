/**
 * 拖动元素组合式函数
 * 按住句柄拖动目标元素：指针位移换算为元素偏移，并自动钳制在视口边界内
 * 适用于面板、浮窗等 fixed 定位元素的拖动场景
 *
 * transform 合并策略（解决与外部 CSS transform 的冲突）：
 * - 未拖动过时不输出 transform，外部 CSS 定义的 transform 原样生效
 * - 每次拖动开始时快照元素的外部 transform（暂时移除自身内联 transform 后读取的计算值，
 *   因此不含此前拖动写入的位移），内联写入 `translate(拖动位移) 外部transform`；位移前置拼接，
 *   保证无论外部是 scale / rotate 还是 matrix3d，拖动始终按屏幕像素 1:1 移动
 * - 快照在每次按下时刷新；拖动期间外部 transform 变化不会实时反映
 */
import { computed, onBeforeUnmount, reactive, ref, type Ref } from 'vue'

export interface UseDragMoveOptions {
    /** 拖动的目标元素（拖动位移应用在该元素的 transform 上） */
    target: Ref<HTMLElement | undefined>
    /** 拖动开关：返回 false 时忽略本次按下（如面板设置 draggable=false） */
    enabled?: () => boolean
    /** 按下起点过滤：返回 true 时忽略本次按下（如起点落在操作按钮上） */
    ignore?: (e: PointerEvent) => boolean
    /** 拖动开始回调（如将面板提到最顶层） */
    onDragStart?: (e: PointerEvent) => void
    /** 拖动位移更新回调（每次 pointermove 触发，如通知连线层重绘） */
    onDragMove?: () => void
}

export function useDragMove(options: UseDragMoveOptions) {
  // 拖动累计位移
  const offset = reactive({ x: 0, y: 0 })
  // 是否已开始过拖动（未拖动时不输出 transform，避免内联样式覆盖外部 CSS）
  const hasDragged = ref(false)
  // 外部 transform 快照（'none' / matrix(...) / matrix3d(...)），不含自身写入的拖动位移
  const externalTransform = ref('none')
  // 拖动期间设为 'transform'，提示浏览器加速
  const willChange = ref('')

  // 对外样式：translate 前置拼接外部 transform 快照
  const style = computed(() => {
    if (!hasDragged.value) return { willChange: willChange.value }
    const translate = `translate(${offset.x}px, ${offset.y}px)`
    const transform = externalTransform.value === 'none' ? translate : `${translate} ${externalTransform.value}`
    return { transform, willChange: willChange.value }
  })

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
    options.onDragMove?.()
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

  // 捕获目标元素的外部 transform（不含自身写入的拖动位移）：
  // 暂时移除自身内联 transform 再读取计算值，避免把上一次拖动的位移计入快照导致再次按下时位移叠加；
  // 读取与还原同步完成，同一帧内不会产生绘制
  function captureExternalTransform(el: HTMLElement) {
    const ownTransform = el.style.transform
    el.style.transform = ''
    const external = getComputedStyle(el).transform
    el.style.transform = ownTransform
    return external
  }

  // 按下句柄开始拖动（Pointer Events 同时兼容鼠标与触摸）
  function onHandlePointerDown(e: PointerEvent) {
    if (options.enabled && !options.enabled()) return
    // 起点被过滤（如落在操作按钮上）时不触发拖动
    if (options.ignore?.(e)) return

    const el = options.target.value
    if (!el) return

    options.onDragStart?.(e)
    // 旧内联 transform 下的视觉矩形（含外部 transform 的渲染位置）
    const rect = el.getBoundingClientRect()
    // 快照外部 transform，拖动位移将前置拼接到它之前
    externalTransform.value = captureExternalTransform(el)
    hasDragged.value = true
    willChange.value = 'transform'

    // 以"视觉位置 - 净位置"绝对重算位移：面板尺寸可能在上次外部快照之后被调整过，
    // 旧内联 transform 里烘焙的外部矩阵（按旧尺寸解析）与刚快照的新矩阵存在差值，
    // 不重算的话抓取瞬间会发生位置跳变
    const ownTransform = el.style.transform
    el.style.transform = ''
    const cleanLeft = el.getBoundingClientRect().left
    const cleanTop = el.getBoundingClientRect().top
    el.style.transform = ownTransform
    offset.x = rect.left - cleanLeft
    offset.y = rect.top - cleanTop

    // 根据元素当前位置与视口尺寸，计算本次拖动的偏移范围，防止元素拖出视口
    // （rect 为渲染后矩形，已包含外部 transform；translate 前置为屏幕空间平移，边界计算依然成立）
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

  // 将元素移动到视口指定坐标（元素左上角对齐该坐标）
  // 以"净位置"为基准绝对重算位移：暂时移除自身内联 transform，读取外部 transform 与渲染矩形，
  // 再内联写入 translate(位移) 外部transform —— 面板尺寸刚被修改时，旧内联 transform 里
  // 烘焙的外部位移（如 translate(-50%,-50%) 按旧尺寸解析的像素）已过期，
  // 绝对重算保证任何"先改尺寸后移动"的序列（排列 / 居中）都精确落位
  function moveTo(x: number, y: number) {
    const el = options.target.value
    if (!el) return
    const ownTransform = el.style.transform
    el.style.transform = ''
    const external = getComputedStyle(el).transform
    const rect = el.getBoundingClientRect()
    el.style.transform = ownTransform
    // 元素尚未渲染（如仍处于最小化隐藏状态）时跳过
    if (rect.width === 0 && rect.height === 0) return
    externalTransform.value = external
    hasDragged.value = true
    offset.x = x - rect.left
    offset.y = y - rect.top
  }

  // 将元素移动到视口中心
  function center() {
    const el = options.target.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    // 元素尚未渲染（如仍处于最小化隐藏状态）时跳过
    if (rect.width === 0 && rect.height === 0) return
    moveTo((window.innerWidth - rect.width) / 2, (window.innerHeight - rect.height) / 2)
  }

  // 开始屏幕空间平移（调整尺寸等场景调用）：快照外部 transform 并启用位移输出。
  // 外部 -50% 类位移被烘焙为固定像素后，后续尺寸变化不再影响视觉左上角位置；
  // 面板尺寸可能在上次烘焙之后又被调整过，重新快照的矩阵与旧矩阵存在差值，
  // 需以"视觉位置 - 净位置"绝对重算位移，保证再次调整尺寸的抓取瞬间不发生跳变
  function beginScreenSpaceMove() {
    const el = options.target.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    externalTransform.value = captureExternalTransform(el)
    hasDragged.value = true
    const ownTransform = el.style.transform
    el.style.transform = ''
    const cleanLeft = el.getBoundingClientRect().left
    const cleanTop = el.getBoundingClientRect().top
    el.style.transform = ownTransform
    offset.x = rect.left - cleanLeft
    offset.y = rect.top - cleanTop
  }

  // 平移当前位移（调整尺寸时补偿位置，保持对侧边缘不动）
  function translateBy(dx: number, dy: number) {
    offset.x += dx
    offset.y += dy
  }

  // 卸载前移除拖动事件监听
  onBeforeUnmount(onPointerUp)

  return { style, onHandlePointerDown, center, moveTo, beginScreenSpaceMove, translateBy }
}
