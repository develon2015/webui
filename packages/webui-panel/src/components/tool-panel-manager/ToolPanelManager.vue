<template>
  <!-- 主题类名切换任务栏配色变量；vertical 类切换为竖排布局 -->
  <div ref="barRef" class="tool-panel-manager" :class="[`theme-${theme}`, { vertical: mode === 'vertical' }]" @wheel="onBarWheel">
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
      @contextmenu.prevent.stop="openMenu($event, panel.id)"
    >
      <!-- 图标：与面板标题栏图标同步显示，未设置时显示默认色块 -->
      <img v-if="panel.icon() && resolvePanelIconType(panel.icon()) === 'img'" class="taskbar-icon is-img" :src="panel.icon()" alt="">
      <span v-else-if="panel.icon() && resolvePanelIconType(panel.icon()) === 'svg'" class="taskbar-icon is-svg" v-html="panel.icon()"></span>
      <span v-else-if="panel.icon()" class="taskbar-icon is-text">{{ panel.icon() }}</span>
      <template v-else>
        <span class="color-block block-1"></span>
        <span class="color-block block-2"></span>
      </template>
      <span class="taskbar-title">{{ panel.title() }}</span>
    </div>

    <!-- 右键菜单（Teleport 到 body，需单独绑定主题类名以继承配色变量） -->
    <Teleport to="body">
      <div v-if="menu.visible" class="context-menu" :class="`theme-${theme}`" :style="{ left: `${menu.x}px`, top: `${menu.y}px` }">
        <!-- 菜单项随面板最小化状态切换：最小化窗口 / 还原窗口 -->
        <div v-if="isMenuPanelMinimized()" class="menu-item" @click="onRestoreWindow">还原窗口</div>
        <div v-else class="menu-item" @click="onMinimizeWindow">最小化窗口</div>
        <div class="menu-item" @click="onCenterWindow">居中显示</div>
        <div class="menu-item" @click="onCloseWindow">关闭窗口</div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { usePanelRegistryStore, type PanelEntry } from './panel-registry'
import { resolvePanelIconType } from '../tool-panel/icon'

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

// 任务项拖动排序状态：active 拖动中、sourceId 被拖动的面板、moved 是否产生过有效移动
const dragState = reactive({ active: false, sourceId: 0, moved: false })
let dragStartX = 0
let dragStartY = 0
let dragPointerId = -1

// 按下任务项：准备拖动排序（仅左键），指针移动超过阈值后进入拖动
function onItemPointerDown(e: PointerEvent, panel: PanelEntry) {
  if (e.button !== 0) return
  dragState.sourceId = panel.id
  dragState.moved = false
  dragState.active = false
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragPointerId = e.pointerId
  document.addEventListener('pointermove', onItemPointerMove)
  document.addEventListener('pointerup', onItemPointerUp)
  document.addEventListener('pointercancel', onItemPointerUp)
}

// 拖动中：指针下的任务项即为目标位置，实时重排
function onItemPointerMove(e: PointerEvent) {
  if (e.pointerId !== dragPointerId || !dragState.sourceId) return
  // 超过阈值才视为拖动，避免影响普通点击
  if (!dragState.active) {
    if (Math.abs(e.clientX - dragStartX) < 4 && Math.abs(e.clientY - dragStartY) < 4) return
    dragState.active = true
    document.body.style.userSelect = 'none'
  }
  const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.taskbar-item') as HTMLElement | null
  const targetId = Number(el?.dataset.panelId)
  if (targetId && targetId !== dragState.sourceId) {
    registry.reorderPanel(dragState.sourceId, targetId)
    dragState.moved = true
  }
}

// 结束拖动排序：清理状态与全局监听
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
  // click 事件在 pointerup 之后触发，延后清零 moved 以抑制拖动后的点击置顶
  if (dragState.moved) {
    setTimeout(() => (dragState.moved = false), 0)
  }
  stopItemDrag()
}

// ===== FLIP 动画 =====
// 任务项顺序变化（拖动排序 / 面板注册注销）时，任务项平滑滑动到新位置：
// watcher 默认 flush: 'pre'，回调里读到的还是旧布局（First）；
// nextTick 等 DOM 更新后（Last）计算位移差，反向写入 transform 再过渡归位（Invert + Play）。
// 使用 offsetLeft/Top 读布局位置，不受进行中的 transform 过渡影响，连续重排也能正确衔接。
watch(() => registry.panels.map(panel => panel.id).join(','), async () => {
  const first = new Map<number, { x: number, y: number }>()
  barRef.value?.querySelectorAll<HTMLElement>('.taskbar-item').forEach((el) => {
    first.set(Number(el.dataset.panelId), { x: el.offsetLeft, y: el.offsetTop })
  })
  await nextTick()
  barRef.value?.querySelectorAll<HTMLElement>('.taskbar-item').forEach((el) => {
    const prev = first.get(Number(el.dataset.panelId))
    if (!prev) return // 新出现的任务项（如面板注册）没有旧位置，不做动画
    const dx = prev.x - el.offsetLeft
    const dy = prev.y - el.offsetTop
    if (!dx && !dy) return
    el.style.transition = 'none'
    el.style.transform = `translate(${dx}px, ${dy}px)`
    el.getBoundingClientRect() // 强制回流，让起始位移先生效
    el.style.transition = 'transform 0.25s ease'
    el.style.transform = ''
    // 过渡结束后清掉内联样式，避免残留
    el.addEventListener('transitionend', () => {
      el.style.transition = ''
      el.style.transform = ''
    }, { once: true })
  })
})

// 右键菜单状态：是否显示、屏幕坐标、菜单指向的面板
const menu = reactive({ visible: false, x: 0, y: 0, panelId: 0 })

// 在光标位置打开某面板的右键菜单
function openMenu(e: MouseEvent, panelId: number) {
  menu.panelId = panelId
  // 防止菜单超出视口（3 个菜单项约高 100px）
  menu.x = Math.min(e.clientX, window.innerWidth - 152)
  menu.y = Math.min(e.clientY, window.innerHeight - 100)
  menu.visible = true
}

// 关闭右键菜单
function hideMenu() {
  menu.visible = false
}

// 菜单项"关闭窗口"：关闭菜单所指向的面板
function onCloseWindow() {
  registry.closePanel(menu.panelId)
  hideMenu()
}

// 菜单项"最小化窗口"：最小化菜单所指向的面板
function onMinimizeWindow() {
  registry.minimizePanel(menu.panelId)
  hideMenu()
}

// 菜单项"还原窗口"：还原菜单所指向的面板
function onRestoreWindow() {
  registry.restorePanel(menu.panelId)
  hideMenu()
}

// 菜单项"居中显示"：将菜单所指向的面板移动到视口中心并置顶
function onCenterWindow() {
  registry.centerPanel(menu.panelId)
  hideMenu()
}

// 菜单所指向的面板是否处于最小化状态
function isMenuPanelMinimized() {
  return registry.panels.find(panel => panel.id === menu.panelId)?.minimized() ?? false
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

// 菜单显示期间监听全局 click / contextmenu：
// 点击任意处或再次右键时自动关闭菜单（打开菜单的事件已 .stop，不会立即触发隐藏）
watch(() => menu.visible, (visible) => {
  if (visible) {
    document.addEventListener('click', hideMenu)
    document.addEventListener('contextmenu', hideMenu)
  } else {
    document.removeEventListener('click', hideMenu)
    document.removeEventListener('contextmenu', hideMenu)
  }
})

// 卸载时关闭菜单并结束拖动排序，随之移除全局监听
onBeforeUnmount(() => {
  hideMenu()
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

    // 正在被拖动排序的任务项：半透明 + 投影呈现"提起"效果
    &.dragging {
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

    &:hover {
      background: var(--menu-hover-bg);
      color: #fff;
    }
  }
}
</style>
