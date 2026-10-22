<template>
  <!-- 主题类名切换任务栏配色变量；vertical 类切换为竖排布局 -->
  <div ref="barRef" class="tool-panel-manager" :class="[`theme-${theme}`, { vertical: mode === 'vertical' }]" @wheel="onBarWheel" @contextmenu.prevent.stop="openBarMenu">
    <!-- 任务栏前插槽：在任务项前插入自定义内容（作为任务栏 flex 子项参与布局） -->
    <div class="taskbar-prepend" v-if="$slots.prepend">
      <slot name="prepend"></slot>
    </div>

    <!-- 任务栏：罗列所有面板实例；按住任务项拖动可调整顺序 -->
    <div
      v-for="panel in registry.panels"
      :key="panel.id"
      class="taskbar-item"
      :class="{ active: panel.id === registry.activeId && !panel.minimized(), minimized: panel.minimized(), dragging: dragState.active && dragState.sourceId === panel.id }"
      :data-panel-id="panel.id"
      :title="panel.title()"
      @pointerdown="onItemPointerDown($event, panel)"
      @click="onTaskItemClick(panel)"
      @contextmenu.prevent.stop="onItemContextMenu($event, panel.id)"
    >
      <!-- 图标：与面板标题栏图标同步显示，未设置时显示默认色块 -->
      <img v-if="panel.icon() && resolvePanelIconType(panel.icon()) === 'img'" class="taskbar-icon is-img" :src="panel.icon()" alt="" @pointerdown.prevent draggable="false">
      <span v-else-if="panel.icon() && resolvePanelIconType(panel.icon()) === 'svg'" class="taskbar-icon is-svg" v-html="panel.icon()"></span>
      <span v-else-if="panel.icon()" class="taskbar-icon is-text">{{ panel.icon() }}</span>
      <template v-else>
        <span class="color-block block-1"></span>
        <span class="color-block block-2"></span>
      </template>
      <span class="taskbar-title">{{ panel.title() }}</span>
    </div>

    <!-- 任务栏后插槽：在任务项后插入自定义内容（作为任务栏 flex 子项参与布局） -->
    <div class="taskbar-append" v-if="$slots.append || $slots.prepend">
      <slot name="append"></slot>
    </div>

    <!-- 右键菜单（Teleport 到 body，需单独绑定主题类名以继承配色变量） -->
    <Teleport to="body">
      <div v-if="menu.visible" class="context-menu" :class="`theme-${theme}`" :style="{ left: `${menu.x}px`, top: `${menu.y}px` }" @contextmenu.prevent.stop>
        <!-- 菜单项随面板最小化状态切换：最小化窗口 / 还原窗口 -->
        <div v-if="isMenuPanelMinimized()" class="menu-item" @click="onMenuClick('restore')">还原窗口</div>
        <div v-else class="menu-item" @click="onMenuClick('minimize')">最小化窗口</div>
        <div class="menu-item" @click="onMenuClick('center')">居中显示</div>
        <div class="menu-item" @click="onMenuClick('close')">关闭窗口</div>
      </div>
    </Teleport>

    <!-- 任务栏右键菜单（Teleport 到 body，需单独绑定主题类名以继承配色变量）：
         空白处右键打开；Shift+右键任务项同样打开；快捷键字母带 Windows 风格下划线 -->
    <Teleport to="body">
      <div v-if="barMenu.visible" class="context-menu" :class="`theme-${theme}`" :style="{ left: `${barMenu.x}px`, top: `${barMenu.y}px` }" @contextmenu.prevent.stop>
        <div class="menu-item" @click="onMenuClick('cascade')">层叠窗口(<span class="accel">D</span>)</div>
        <div class="menu-item" @click="onMenuClick('grid')">平铺显示窗口(<span class="accel">T</span>)</div>
        <div class="menu-item" @click="onMenuClick('stack')">堆叠显示窗口(<span class="accel">E</span>)</div>
        <div class="menu-item" @click="onMenuClick('sideBySide')">并排显示窗口(<span class="accel">I</span>)</div>
        <div class="menu-item" @click="onMenuClick('showAll')">显示全部窗口</div>
        <div class="menu-item" @click="onMenuClick('minimizeAll')">最小化全部窗口</div>
        <div class="menu-item" @click="onMenuClick('closeAll')">关闭全部窗口</div>
      </div>
    </Teleport>

    <!-- 面板层级连线：根据面板 parent 关系在 body 上绘制穿透画布（内部含多实例单例守卫） -->
    <ToolPanelHierarchy :theme="theme" />
  </div>
</template>

<script lang="ts">
// 多管理器实例间的菜单互斥锁（模块级变量，跨组件实例共享）：
// 页面上可能同时存在多个管理器实例（底部任务栏 / 竖排任务栏 / 面板内嵌任务栏），
// 若不加锁，各实例的右键菜单可能同时显示并相互叠放，导致误点其它实例的菜单项
let menuCloser: (() => void) | null = null
</script>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { usePanelRegistryStore, type PanelEntry } from './panel-registry'
import { resolvePanelIconType } from '../tool-panel/icon'
import ToolPanelHierarchy from '../tool-panel-hierarchy/ToolPanelHierarchy.vue'

// 组件属性：theme 决定任务栏与右键菜单配色，mode 决定任务栏布局方向
const props = withDefaults(defineProps<{
  /** 主题：'dark' 绝对黑暗黑风格（默认）；'sci-fi' 蓝色科幻风格 */
  theme?: 'dark' | 'sci-fi'
  /** 布局方向：'horizontal' 底部横向任务栏（默认）；'vertical' 左侧竖向任务栏 */
  mode?: 'horizontal' | 'vertical'
}>(), {
  theme: 'dark',
  mode: 'horizontal',
})

// 面板注册表：任务栏的数据源
const registry = usePanelRegistryStore()

// 任务栏根元素（滚轮滚动容器）
const barRef = ref<HTMLElement>()

// 横向模式任务项过多时：把滚轮的纵向滚动量转为任务栏的横向滚动
// 竖排模式交给浏览器原生纵向滚动，无需处理
function onBarWheel(e: WheelEvent) {
  if (props.mode === 'vertical') return
  const bar = barRef.value
  if (!bar || bar.scrollWidth <= bar.clientWidth) return
  e.preventDefault()
  bar.scrollLeft += e.deltaY + e.deltaX
}

// 任务项拖动状态：active 拖动中、sourceId 被拖动的面板、moved 是否产生过拖动
const dragState = reactive({ active: false, sourceId: 0, moved: false })
let dragStartX = 0
let dragStartY = 0
let dragPointerId = -1
let dragOriginLeft = 0
let dragOriginTop = 0

// 按下任务项：准备拖动（仅左键），记录任务项的原始布局位置
function onItemPointerDown(e: PointerEvent, panel: PanelEntry) {
  if (e.button !== 0) return
  const item = e.currentTarget as HTMLElement
  dragState.sourceId = panel.id
  dragState.moved = false
  dragState.active = false
  dragOriginLeft = item.offsetLeft
  dragOriginTop = item.offsetTop
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragPointerId = e.pointerId
  document.addEventListener('pointermove', onItemPointerMove)
  document.addEventListener('pointerup', onItemPointerUp)
  document.addEventListener('pointercancel', onItemPointerUp)
}

// 拖动中：只有被拖动的任务项沿任务栏布局方向移动（位移钳制在任务栏范围内），其它任务项保持不动
function onItemPointerMove(e: PointerEvent) {
  if (e.pointerId !== dragPointerId || !dragState.sourceId) return
  const bar = barRef.value
  if (!bar) return
  const item = bar.querySelector<HTMLElement>(`.taskbar-item[data-panel-id="${dragState.sourceId}"]`)
  if (!item) return

  // 超过阈值才视为拖动，避免影响普通点击
  if (!dragState.active) {
    if (Math.abs(e.clientX - dragStartX) < 4 && Math.abs(e.clientY - dragStartY) < 4) return
    dragState.active = true
    dragState.moved = true
    document.body.style.userSelect = 'none'
  }

  if (props.mode === 'vertical') {
    const dy = Math.min(Math.max(e.clientY - dragStartY, -dragOriginTop), bar.scrollHeight - item.offsetHeight - dragOriginTop)
    item.style.transform = `translate(0, ${dy}px)`
  } else {
    const dx = Math.min(Math.max(e.clientX - dragStartX, -dragOriginLeft), bar.scrollWidth - item.offsetWidth - dragOriginLeft)
    item.style.transform = `translate(${dx}px, 0)`
  }
}

// 结束拖动：清理状态与全局监听（内联位移由 FLIP watcher 或落点逻辑清理）
function stopItemDrag() {
  dragState.active = false
  dragState.sourceId = 0
  document.body.style.userSelect = ''
  document.removeEventListener('pointermove', onItemPointerMove)
  document.removeEventListener('pointerup', onItemPointerUp)
  document.removeEventListener('pointercancel', onItemPointerUp)
}

function onItemPointerUp(e: PointerEvent) {
  if (e.pointerId !== dragPointerId) return
  if (dragState.active && e.type !== 'pointercancel') {
    dropDraggedItem(e)
    // click 事件在 pointerup 之后触发，延后清零 moved 以抑制拖动后的点击置顶
    setTimeout(() => (dragState.moved = false), 0)
  } else if (dragState.active) {
    // pointercancel：放弃拖动，直接清掉内联位移归位
    const item = barRef.value?.querySelector<HTMLElement>(`.taskbar-item[data-panel-id="${dragState.sourceId}"]`)
    if (item) item.style.transform = ''
  }
  stopItemDrag()
}

// 放开鼠标：根据当前指针位置计算目标下标（越过其余任务项中线算作插到它前面），一次性重排
function dropDraggedItem(e: PointerEvent) {
  const bar = barRef.value
  if (!bar) return
  const item = bar.querySelector<HTMLElement>(`.taskbar-item[data-panel-id="${dragState.sourceId}"]`)
  if (!item) return
  const vertical = props.mode === 'vertical'
  const pointer = vertical ? e.clientY : e.clientX

  // 其余任务项按当前布局顺序排列，第一个"中心在指针后方"的任务项即为目标插入点
  const others = [...bar.querySelectorAll<HTMLElement>('.taskbar-item')]
    .filter(el => Number(el.dataset.panelId) !== dragState.sourceId)
  let toIndex = others.length
  for (const [i, other] of others.entries()) {
    const r = other.getBoundingClientRect()
    const center = vertical ? r.top + r.height / 2 : r.left + r.width / 2
    if (pointer < center) {
      toIndex = i
      break
    }
  }

  // 顺序有变化才通知 store（FLIP watcher 会播放滑动动画并清理内联位移）
  const before = registry.panels.map(panel => panel.id).join(',')
  registry.movePanel(dragState.sourceId, toIndex)
  if (registry.panels.map(panel => panel.id).join(',') === before) {
    item.style.transform = '' // 顺序没变，直接归位
  }
}

// ===== FLIP 动画 =====
// 任务项顺序变化（拖动落点重排 / 面板注册注销）时，任务项平滑滑动到新位置：
// - First 取 getBoundingClientRect（真实视觉位置）：拖动中的任务项带着内联位移，
//   松手后会从"手松开的位置"滑向新槽位，而不是跳回原位再滑动；
// - nextTick 后先清掉拖动写入的内联 transform、cancel 旧动画，再读纯布局位置
//   （全部在同一帧内完成，不产生绘制），差值即为起始偏移；
// - 用 Web Animations API 播放，连续重排也不会残留内联样式。
watch(() => registry.panels.map(panel => panel.id).join(','), () => {
  // First：记录每个任务项当前的视觉位置（此时 DOM 尚未更新）
  const first = new Map<number, { x: number, y: number }>()
  barRef.value?.querySelectorAll<HTMLElement>('.taskbar-item').forEach((el) => {
    const rect = el.getBoundingClientRect()
    first.set(Number(el.dataset.panelId), { x: rect.left, y: rect.top })
  })
  nextTick(() => {
    barRef.value?.querySelectorAll<HTMLElement>('.taskbar-item').forEach((el) => {
      const prev = first.get(Number(el.dataset.panelId))
      if (!prev) return // 新注册的任务项没有旧位置，不做动画
      el.style.transform = '' // 清除拖动期间写入的内联位移
      el.getAnimations().forEach(anim => anim.cancel())
      const rect = el.getBoundingClientRect()
      const dx = prev.x - rect.left
      const dy = prev.y - rect.top
      if (!dx && !dy) return
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: 'translate(0, 0)' },
        ],
        { duration: 200, easing: 'ease-out' },
      )
    })
  })
})

// 右键菜单状态：是否显示、屏幕坐标、菜单指向的面板
const menu = reactive({ visible: false, x: 0, y: 0, panelId: 0 })

// 任务栏右键菜单状态（窗口排列等全局操作）
const barMenu = reactive({ visible: false, x: 0, y: 0 })

// 在光标位置打开某面板的右键菜单
function openMenu(e: MouseEvent, panelId: number) {
  claimMenus() // 关闭其它实例已打开的菜单，保证全局同时只显示一个菜单
  menu.panelId = panelId
  // 防止菜单超出视口（3 个菜单项约高 100px）
  menu.x = Math.min(e.clientX, window.innerWidth - 152)
  menu.y = Math.min(e.clientY, window.innerHeight - 100)
  menu.visible = true
}

// 在光标位置打开任务栏右键菜单（任务栏空白处右键 / Shift+右键任务项）
function openBarMenu(e: MouseEvent) {
  claimMenus() // 关闭其它实例已打开的菜单，保证全局同时只显示一个菜单
  // 防止菜单超出视口（7 个菜单项约高 220px）
  barMenu.x = Math.min(e.clientX, window.innerWidth - 152)
  barMenu.y = Math.min(e.clientY, window.innerHeight - 220)
  barMenu.visible = true
}

// 任务项右键：按住 Shift 打开任务栏菜单，否则打开该面板的菜单
function onItemContextMenu(e: MouseEvent, panelId: number) {
  if (e.shiftKey) {
    openBarMenu(e)
  } else {
    openMenu(e, panelId)
  }
}

// 菜单所指向的面板是否处于最小化状态
function isMenuPanelMinimized() {
  return registry.panels.find(panel => panel.id === menu.panelId)?.minimized() ?? false
}

// 计算窗口排列的工作区（扣除任务栏自身占位）
function getWorkArea() {
  if (props.mode === 'vertical') {
    const width = barRef.value?.offsetWidth ?? 0
    return { x: width, y: 0, width: window.innerWidth - width, height: window.innerHeight }
  }
  return { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight - 40 }
}

// ===== 菜单功能（面板菜单 / 任务栏菜单的菜单项回调与外部 ref 调用共用）=====
// 面板级功能：作用于指定面板（id 可从 registry.panels 获得）

/** 关闭指定面板（菜单项"关闭窗口"） */
function closeWindow(id: number) {
  registry.closePanel(id)
}

/** 最小化指定面板（菜单项"最小化窗口"） */
function minimizeWindow(id: number) {
  registry.minimizePanel(id)
}

/** 还原指定面板（取消最小化并置顶，菜单项"还原窗口"） */
function restoreWindow(id: number) {
  registry.restorePanel(id)
}

/** 将指定面板移动到视口中心并置顶（菜单项"居中显示"） */
function centerWindow(id: number) {
  registry.centerPanel(id)
}

// 任务栏级功能：作用于全部未最小化窗口（排列工作区按任务栏自身布局计算）

/** 所有未最小化面板沿右下层叠排列，尺寸不变（菜单项"层叠窗口"） */
function cascadeWindows() {
  registry.cascadePanels(getWorkArea())
}

/** 所有未最小化面板按自然尺寸沿纵向平铺（菜单项"堆叠显示窗口"） */
function stackWindows() {
  registry.stackPanels(getWorkArea())
}

/** 所有未最小化面板按自然尺寸沿横向平铺（菜单项"并排显示窗口"） */
function sideBySideWindows() {
  registry.sideBySidePanels(getWorkArea())
}

/** 所有未最小化面板按自然尺寸做二维网格瀑布式平铺（菜单项"平铺显示窗口"） */
function gridWindows() {
  registry.gridPanels(getWorkArea())
}

/** 还原所有最小化的面板，并按自然尺寸做网格排列（菜单项"显示全部窗口"） */
function showAllWindows() {
  registry.showAllPanels(getWorkArea())
}

/** 最小化全部面板（菜单项"最小化全部窗口"） */
function minimizeAllWindows() {
  registry.minimizeAllPanels()
}

/** 关闭全部面板（菜单项"关闭全部窗口"） */
function closeAllWindows() {
  registry.closeAllPanels()
}

// 菜单项动作标识：面板菜单作用于菜单所指向的面板，任务栏菜单为全局窗口操作
type MenuAction =
  | 'restore' | 'minimize' | 'center' | 'close'
  | 'cascade' | 'grid' | 'stack' | 'sideBySide' | 'showAll' | 'minimizeAll' | 'closeAll'

// 两个右键菜单的菜单项点击统一入口：按动作标识分发到对应功能，执行后关闭菜单
function onMenuClick(action: MenuAction) {
  switch (action) {
    // 面板菜单：作用于菜单所指向的面板
    case 'restore':
      restoreWindow(menu.panelId)
      break
    case 'minimize':
      minimizeWindow(menu.panelId)
      break
    case 'center':
      centerWindow(menu.panelId)
      break
    case 'close':
      closeWindow(menu.panelId)
      break
    // 任务栏菜单：全局窗口操作
    case 'cascade':
      cascadeWindows()
      break
    case 'grid':
      gridWindows()
      break
    case 'stack':
      stackWindows()
      break
    case 'sideBySide':
      sideBySideWindows()
      break
    case 'showAll':
      showAllWindows()
      break
    case 'minimizeAll':
      minimizeAllWindows()
      break
    case 'closeAll':
      closeAllWindows()
      break
  }
  // 执行完毕关闭菜单（菜单互斥保证同时只显示一个，关闭所有即可）
  closeAllMenus()
}

// 任务栏点击：还原已最小化面板并置顶；点击当前激活面板则最小化（类 Windows 行为）；否则置顶
function onTaskItemClick(panel: PanelEntry) {
  // 拖动排序结束后的 click 不触发置顶 / 最小化
  if (dragState.moved) return
  if (panel.minimized()) {
    registry.restorePanel(panel.id)
  } else if (registry.activeId === panel.id) {
    registry.minimizePanel(panel.id)
  } else {
    registry.tapPanel(panel.id)
  }
}

// 任一菜单显示期间监听全局 click / contextmenu：
// 点击任意处或再次右键时自动关闭所有菜单（打开菜单的事件已 .stop，不会立即触发隐藏）
watch(() => menu.visible || barMenu.visible, (visible) => {
  if (visible) {
    document.addEventListener('click', closeAllMenus)
    document.addEventListener('contextmenu', closeAllMenus)
  } else {
    document.removeEventListener('click', closeAllMenus)
    document.removeEventListener('contextmenu', closeAllMenus)
  }
})

// 接管菜单互斥锁：先关闭其它实例已打开的菜单（调用其 closeAllMenus），再由本实例持锁
function claimMenus() {
  menuCloser?.()
  menuCloser = closeAllMenus
}

// 关闭本实例的所有右键菜单（持有互斥锁时同时释放）
function closeAllMenus() {
  menu.visible = false
  barMenu.visible = false
  if (menuCloser === closeAllMenus) menuCloser = null
}

// 对外暴露菜单功能：父组件可通过组件 ref 直接调用，例如
// const manager = ref<InstanceType<typeof ToolPanelManager>>()
// manager.value.cascadeWindows()          // 层叠全部窗口
// manager.value.closeWindow(panelId)      // 关闭指定面板（id 取自 manager.value.panels）
defineExpose({
  /** 关闭指定面板（菜单"关闭窗口"） */
  closeWindow,
  /** 最小化指定面板（菜单"最小化窗口"） */
  minimizeWindow,
  /** 还原指定面板（菜单"还原窗口"） */
  restoreWindow,
  /** 将指定面板移动到视口中心并置顶（菜单"居中显示"） */
  centerWindow,
  /** 所有未最小化面板沿右下层叠排列（菜单"层叠窗口"） */
  cascadeWindows,
  /** 所有未最小化面板按自然尺寸沿纵向平铺（菜单"堆叠显示窗口"） */
  stackWindows,
  /** 所有未最小化面板按自然尺寸沿横向平铺（菜单"并排显示窗口"） */
  sideBySideWindows,
  /** 所有未最小化面板按自然尺寸做二维网格瀑布式平铺（菜单"平铺显示窗口"） */
  gridWindows,
  /** 还原所有最小化的面板，并按自然尺寸做网格排列（菜单"显示全部窗口"） */
  showAllWindows,
  /** 最小化全部面板（菜单"最小化全部窗口"） */
  minimizeAllWindows,
  /** 关闭全部面板（菜单"关闭全部窗口"） */
  closeAllWindows,
})

// 卸载时关闭菜单并结束拖动排序，随之移除全局监听
onBeforeUnmount(() => {
  closeAllMenus()
  stopItemDrag()
})
</script>

<style lang="scss" scoped>
// 任务栏：类似 Windows 状态栏，固定在视口底部
// ===== 主题配色（CSS 变量） =====
// 默认：暗黑主题（绝对黑底 + 明亮高对比）；.theme-sci-fi 覆盖为蓝色科幻配色
.tool-panel-manager {
  --bar-bg: #000000;
  --bar-border-color: rgba(255, 255, 255, 0.16);
  --item-bg: transparent;
  --item-border: rgba(255, 255, 255, 0.2);
  --item-color: #d4d4d4;
  --item-hover-bg: rgba(255, 255, 255, 0.16);
  --item-active-bg: rgba(255, 255, 255, 0.28);
  --block-1-bg: linear-gradient(180deg, #ffffff 0%, #9e9e9e 100%);
  --block-2-bg: linear-gradient(180deg, #ffffff 0%, #cfcfcf 100%);

  // 蓝色科幻主题
  &.theme-sci-fi {
    --bar-bg: linear-gradient(180deg, #071d40f2 2%, #04255ef2 100%);
    --bar-border-color: rgba(90, 140, 255, 0.45);
    --item-bg: rgba(41, 173, 255, 0.12);
    --item-border: rgba(90, 140, 255, 0.35);
    --item-color: #c5d8f0;
    --item-hover-bg: rgba(41, 173, 255, 0.25);
    --item-active-bg: rgba(41, 173, 255, 0.35);
    --block-1-bg: linear-gradient(180deg, #61d8ff 0%, #29adff 100%);
    --block-2-bg: linear-gradient(180deg, #1de9ea 0%, #b7ffff 100%);
  }

  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  // 取 int32 上限-1，始终压在所有面板之上
  z-index: 2147483646;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 8px;
  background: var(--bar-bg);
  border-top: 1px solid var(--bar-border-color);
  // 任务项过多时横向滚动（通过鼠标滚轮滚动，见 onBarWheel），隐藏滚动条保持任务栏外观
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;

  // 竖排模式：停靠在视口左侧，任务项自上而下排列
  &.vertical {
    flex-direction: column;
    align-items: stretch;
    right: auto;
    top: 0;
    width: fit-content;
    min-width: 56px;
    max-width: 168px;
    height: auto;
    padding: 8px 0;
    border-top: none;
    border-right: 1px solid var(--bar-border-color);
    overflow-y: auto;
  }

  .taskbar-item {
    height: 30px;
    max-width: 160px;
    padding: 0 14px;
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--item-bg);
    border: 1px solid var(--item-border);
    border-radius: 4px;
    font-size: 12px;
    color: var(--item-color);
    cursor: pointer;
    user-select: none;
    transition: background 0.15s;
    // 允许触摸拖动排序（阻止浏览器把手势识别为页面滚动）
    touch-action: none;

    &:hover {
      background: var(--item-hover-bg);
    }

    &.active {
      background: var(--item-active-bg);
      color: #fff;
    }

    // 最小化的面板：弱化显示
    &.minimized {
      opacity: 0.55;
    }

    // 正在被拖动的任务项：提升层级压在其它项之上，半透明 + 投影呈现"提起"效果
    &.dragging {
      position: relative;
      z-index: 1;
      opacity: 0.85;
      cursor: grabbing;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    }

    // 自定义图标（与面板标题栏图标同步）
    .taskbar-icon {
      height: 14px;
      flex-shrink: 0;
      color: currentColor;

      // 图片地址图标
      &.is-img {
        display: block;
        width: 14px;
        object-fit: contain;
      }

      // 内联 svg 图标
      &.is-svg {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 14px;

        :deep(svg) {
          width: 100%;
          height: 100%;
        }
      }

      // 文本 / emoji 图标
      &.is-text {
        display: inline-block;
        font-size: 12px;
        line-height: 14px;
        text-align: center;
      }
    }

    .color-block {
      width: 5px;
      height: 10px;
      border-radius: 2px;
      transform: skewX(-18deg);
      flex-shrink: 0;

      &.block-1 {
        background: var(--block-1-bg);
      }

      &.block-2 {
        background: var(--block-2-bg);
      }
    }

    .taskbar-title {
      display: flex;
      align-items: center;
      line-height: 1;
      padding-bottom: 1px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  }

  .taskbar-prepend, .taskbar-append {
    display: flex;
    flex: 1;
    color: var(--item-color);
  }
}

// 右键菜单：Teleport 到 body 渲染，避免受任务栏层叠上下文影响（主题类名绑定在菜单元素上）
.context-menu {
  --menu-bg: #000000;
  --menu-border: rgba(255, 255, 255, 0.2);
  --menu-shadow: rgba(0, 0, 0, 0.8);
  --menu-color: #d4d4d4;
  --menu-hover-bg: rgba(255, 255, 255, 0.16);

  // 蓝色科幻主题
  &.theme-sci-fi {
    --menu-bg: #0a2450f2;
    --menu-border: #5A8CFF;
    --menu-shadow: rgba(0, 0, 0, 0.5);
    --menu-color: #c5d8f0;
    --menu-hover-bg: rgba(41, 173, 255, 0.3);
  }

  position: fixed;
  min-width: 140px;
  padding: 4px;
  background: var(--menu-bg);
  border: 1px solid var(--menu-border);
  border-radius: 4px;
  box-shadow: 0 8px 24px var(--menu-shadow);
  // 需盖过任务栏
  z-index: 2147483647;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;

  .menu-item {
    padding: 6px 12px;
    border-radius: 3px;
    font-size: 13px;
    color: var(--menu-color);
    cursor: pointer;
    user-select: none;

    // Windows 风格的快捷键字母下划线
    .accel {
      text-decoration: underline;
    }

    &:hover {
      background: var(--menu-hover-bg);
      color: #fff;
    }
  }
}
</style>
