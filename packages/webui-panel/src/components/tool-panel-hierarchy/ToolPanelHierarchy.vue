<template>
  <!-- 层级连线画布：Teleport 到 body 全屏铺开；pointer-events: none 鼠标事件穿透 -->
  <Teleport to="body">
    <canvas v-if="isPrimary" ref="canvasRef" class="tool-panel-hierarchy"></canvas>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePanelRegistryStore } from '../tool-panel-manager/panel-registry'
import { useHierarchyRegistryStore } from './hierarchy-registry'

// 组件属性：theme 决定连线配色（与面板 / 任务栏主题保持一致）
const props = withDefaults(defineProps<{
  /** 主题：'dark' 白色连线（默认）；'sci-fi' 青色连线 */
  theme?: 'dark' | 'sci-fi'
}>(), {
  theme: 'dark',
})

// 面板注册表：连线数据源（面板列表、最小化状态、几何变化信号）
const registry = usePanelRegistryStore()
// 层级连线组件注册表：多实例单例守卫
const hierarchyRegistry = useHierarchyRegistryStore()

// ===== 单例守卫（store 实现） =====
// 多个 ToolPanelManager 会各自挂载本组件；实例挂载时在 store 登记领取实例 id，
// v-if 仅让 id 列表中第一个实例渲染画布；首个实例卸载后由列表中下一个实例自动接管
const instanceId = ref(0) // 本实例 id；0 表示尚未登记
const isPrimary = computed(() => instanceId.value !== 0 && hierarchyRegistry.firstInstanceId === instanceId.value)

// 连线主题配色（画布无法直接消费 CSS 变量，映射为 JS 颜色值）
const themeColors = computed(() => props.theme === 'sci-fi'
  ? { lineStart: '#61d8ff', lineEnd: '#1de9ea', dot: '#1de9ea' }
  : { lineStart: '#ffffff', lineEnd: '#9e9e9e', dot: '#ffffff' })

const canvasRef = ref<HTMLCanvasElement>()
let ctx: CanvasRenderingContext2D | undefined
let drawScheduled = false // 本帧是否已安排重绘（rAF 合帧，高频触发源只绘一次）

// 安排在下一帧重绘（拖动 / 注册注销 / 最小化 / 窗口缩放等触发源共用）
function scheduleDraw() {
  if (drawScheduled || !isPrimary.value) return
  drawScheduled = true
  requestAnimationFrame(() => {
    drawScheduled = false
    draw()
  })
}

// 同步画布尺寸（含 devicePixelRatio 缩放，保证高清屏线条清晰）
function syncCanvasSize() {
  const canvas = canvasRef.value
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  const width = window.innerWidth
  const height = window.innerHeight
  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr
    canvas.height = height * dpr
  }
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
}

// 绘制所有父子连线
function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  syncCanvasSize()
  if (!ctx) return
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

  const panels = registry.panels
  const byId = new Map(panels.map(panel => [panel.id, panel]))
  const colors = themeColors.value

  for (const panel of panels) {
    const parent = byId.get(panel.parentId())
    // 面板或其父级不存在 / 被最小化时不参与连线
    if (!parent || panel.minimized() || parent.minimized()) continue
    const childEl = panel.el()
    const parentEl = parent.el()
    if (!childEl || !parentEl) continue

    const childRect = childEl.getBoundingClientRect()
    const parentRect = parentEl.getBoundingClientRect()
    // 面板处于隐藏状态（宽高为 0）时跳过
    if (!childRect.width && !childRect.height) continue
    if (!parentRect.width && !parentRect.height) continue

    drawLink(childRect, parentRect, colors)
  }
}

// 计算从 from 出发朝 to 方向离开 rect 边界的参数 t（0~1，from 位于 rect 内部）
function exitT(rect: DOMRect, from: { x: number, y: number }, to: { x: number, y: number }) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  let t = 1
  if (dx > 0) t = Math.min(t, (rect.right - from.x) / dx)
  else if (dx < 0) t = Math.min(t, (rect.left - from.x) / dx)
  if (dy > 0) t = Math.min(t, (rect.bottom - from.y) / dy)
  else if (dy < 0) t = Math.min(t, (rect.top - from.y) / dy)
  return Math.max(0, Math.min(1, t))
}

// 绘制一条父子连线：截取两个面板边界之间的线段，渐变描边并在两端绘制锚点
function drawLink(childRect: DOMRect, parentRect: DOMRect, colors: { lineStart: string, lineEnd: string, dot: string }) {
  if (!ctx) return
  const from = { x: childRect.left + childRect.width / 2, y: childRect.top + childRect.height / 2 }
  const to = { x: parentRect.left + parentRect.width / 2, y: parentRect.top + parentRect.height / 2 }
  if (from.x === to.x && from.y === to.y) return // 中心重合，无从画起

  // 线段截取（from→to 方向参数化）：tStart 为离开子面板边界的参数，tEnd 为进入父面板边界的参数；
  // 面板重叠导致区间倒置时退化为中心连线
  let tStart = exitT(childRect, from, to)
  let tEnd = 1 - exitT(parentRect, to, from)
  if (tStart > tEnd) {
    tStart = 0
    tEnd = 1
  }
  const start = { x: from.x + (to.x - from.x) * tStart, y: from.y + (to.y - from.y) * tStart }
  const end = { x: from.x + (to.x - from.x) * tEnd, y: from.y + (to.y - from.y) * tEnd }

  const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y)
  gradient.addColorStop(0, colors.lineStart)
  gradient.addColorStop(1, colors.lineEnd)

  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  ctx.globalAlpha = 0.6
  ctx.strokeStyle = gradient
  ctx.beginPath()
  ctx.moveTo(start.x, start.y)
  ctx.lineTo(end.x, end.y)
  ctx.stroke()

  // 两端锚点
  ctx.globalAlpha = 0.9
  ctx.fillStyle = colors.dot
  for (const point of [start, end]) {
    ctx.beginPath()
    ctx.arc(point.x, point.y, 2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

// 面板注册 / 注销 / 任务栏排序变化时重绘
watch(() => registry.panels.map(panel => panel.id).join(','), scheduleDraw)
// 最小化状态变化时重绘（最小化的面板不参与连线）
watch(() => registry.panels.map(panel => panel.minimized()).join(','), scheduleDraw)
// 面板几何变化（拖动 / 还原 / 居中）时重绘
watch(() => registry.layoutTick, scheduleDraw)
// 主题变化时重绘（连线配色跟随）
watch(() => props.theme, scheduleDraw)
// 视口尺寸变化时重绘（画布尺寸与连线几何都依赖视口）
window.addEventListener('resize', scheduleDraw)

// 实例成为首位（首次挂载或接管画布）时初始化绘制上下文并重绘
watch(isPrimary, async (primary) => {
  if (!primary) return
  await nextTick()
  ctx = canvasRef.value?.getContext('2d') ?? undefined
  scheduleDraw()
})

// 挂载时在 store 登记领取实例 id，isPrimary 变化驱动画布渲染
onMounted(() => {
  instanceId.value = hierarchyRegistry.register()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', scheduleDraw)
  hierarchyRegistry.unregister(instanceId.value)
})
</script>

<style lang="scss" scoped>
.tool-panel-hierarchy {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  // 鼠标事件穿透：连线仅作视觉展示，不阻挡下层面板的交互
  pointer-events: none;
  // 压在所有面板之上、任务栏之下（任务栏 2147483646 / 右键菜单 2147483647）
  z-index: 2147483645;
}
</style>
