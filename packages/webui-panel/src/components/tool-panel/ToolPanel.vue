<template>
  <Teleport to="body">
    <!-- 面板根节点：v-show 控制显隐（关闭或最小化时隐藏），主题类名切换配色变量；
         v-bind 需在 :style 之前，保证排列尺寸（样式绑定内的 width/height）覆盖父组件内联样式 -->
    <div v-show="!minimized" ref="panelRef" class="tool-panel" :class="`theme-${theme}`" v-bind="{ ...attrs, ...scoped }" :style="style" >
      <!-- 标题栏：按住可拖动面板 -->
      <div class="panel-header" :class="{ 'is-draggable': draggable }" @pointerdown="onHandlePointerDown">
        <div class="header-decoration">
          <!-- 图标：默认色块；可通过 icon prop（内联 svg / 图片地址 / emoji 文本）或 #icon 插槽自定义，任务栏同步显示 -->
          <slot name="icon">
            <img v-if="iconType === 'img'" class="panel-icon is-img" :src="icon" alt="" draggable="false">
            <span v-else-if="iconType === 'svg'" class="panel-icon is-svg" v-html="icon"></span>
            <span v-else-if="icon" class="panel-icon is-text">{{ icon }}</span>
            <template v-else>
              <span class="color-block block-1"></span>
              <span class="color-block block-2"></span>
            </template>
          </slot>
        </div>
        <!-- 面板标题 -->
        <slot name="title">
          <span class="panel-title">{{ title }}</span>
        </slot>
        <!-- 操作按钮组 -->
        <slot name="op">
          <div class="op-btn setting" @click="emit('setting')" v-if="btns.includes('setting')">
            <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" style="color:#fff"><defs><g id="t"><rect x="-6" y="-32" width="12" height="14" rx="2" fill="currentColor"/></g></defs><g transform="translate(50,50)"><circle r="22" fill="currentColor"/><use href="#t"/><use href="#t" transform="rotate(45)"/><use href="#t" transform="rotate(90)"/><use href="#t" transform="rotate(135)"/><use href="#t" transform="rotate(180)"/><use href="#t" transform="rotate(225)"/><use href="#t" transform="rotate(270)"/><use href="#t" transform="rotate(315)"/><circle r="12" style="fill: #000"/></g></svg>
          </div>
          <div class="op-btn menu" @click="emit('menu')" v-if="btns.includes('menu')">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" style="color:#fff"><defs><g id="item" fill="currentColor"><ellipse cx="2.5" cy="3.167" rx="0.833" ry="0.833"/><path d="M13.833,3.666 L5.103,3.666 A0.5,0.5 0 0,0 5.103,2.666 L13.833,2.666 Z"/></g></defs><use href="#item"/><use href="#item" transform="translate(0,4.666)"/><use href="#item" transform="translate(0,9.666)"/></svg>
          </div>
          <div class="op-btn min" @click="minimize" v-if="btns.includes('min')">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" style="color: #fff"><rect x="2.1667" y="7.6667" width="11.6667" height="1" rx="0.5" fill="currentColor"/></svg>
          </div>
          <div class="op-btn close" @click="close" v-if="btns.includes('close')">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" style="color: #fff"><path d="M14.1871 13.1265L13.1265 14.1872L1.81275 2.87347L2.87341 1.81281L14.1871 13.1265Z" fill="currentColor"></path><path d="M13.1265 1.81282L14.1871 2.87348L2.8734 14.1872L1.81274 13.1265L13.1265 1.81282Z" fill="currentColor"></path></svg>
          </div>
        </slot>
      </div>
      <!-- 面板内容区 -->
      <div class="panel-body">
        <slot name="default"></slot>
      </div>
      <!-- 尺寸调整手柄：覆盖边缘 / 四角的透明热区，按住拖动调整面板尺寸（resizable=false 时不渲染） -->
      <template v-if="resizable">
        <div class="resize-handle n" @pointerdown.stop="onResizeHandlePointerDown($event, 'n')"></div>
        <div class="resize-handle s" @pointerdown.stop="onResizeHandlePointerDown($event, 's')"></div>
        <div class="resize-handle e" @pointerdown.stop="onResizeHandlePointerDown($event, 'e')"></div>
        <div class="resize-handle w" @pointerdown.stop="onResizeHandlePointerDown($event, 'w')"></div>
        <div class="resize-handle ne" @pointerdown.stop="onResizeHandlePointerDown($event, 'ne')"></div>
        <div class="resize-handle nw" @pointerdown.stop="onResizeHandlePointerDown($event, 'nw')"></div>
        <div class="resize-handle se" @pointerdown.stop="onResizeHandlePointerDown($event, 'se')"></div>
        <div class="resize-handle sw" @pointerdown.stop="onResizeHandlePointerDown($event, 'sw')"></div>
      </template>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useAttrs } from 'vue'
import { useZIndexStore } from './z-index'
import { usePanelRegistryStore } from '../tool-panel-manager/panel-registry'
import { resolvePanelIconType } from './icon'
import { useScopedAttrs } from '@/composables/useScopedAttrs';
import { useDragMove } from '@/composables/useDragMove'
import { useDragResize } from '@/composables/useDragResize'

type SideButton = 'setting' | 'menu' | 'min' | 'close'

// 组件属性：标题、显示哪些操作按钮、是否可拖动、是否可调整尺寸、面板图标
const props = withDefaults(defineProps<{
  title: string
  btns?: SideButton[]
  draggable?: boolean
  /** 是否允许拖拽边缘 / 四角调整面板尺寸（类 Windows 行为，最小 240x80） */
  resizable?: boolean
  /** 面板图标：内联 svg 字符串 / 图片地址（http、data、相对路径等）/ emoji 等文本；为空时显示默认色块，任务栏同步显示。内联 svg 通过 v-html 渲染，请勿传入不可信内容 */
  icon?: string
  /** 主题：'dark' 绝对黑暗黑风格（默认）；'sci-fi' 蓝色科幻风格 */
  theme?: 'dark' | 'sci-fi'
  /** 父面板 id（父面板实例暴露的 id 属性，0 表示无父级），层级连线组件据此绘制父子连线 */
  parent?: number
}>(), {
  btns: () => ['setting', 'menu', 'min', 'close'],
  draggable: true,
  resizable: true,
  icon: '',
  theme: 'dark',
  parent: 0,
})

// 自定义事件：对应各操作按钮的点击
const emit = defineEmits<{
  menu: []
  min: []
  close: []
  setting: []
}>()

const attrs = useAttrs()
const scoped = useScopedAttrs()

// 面板根元素
const panelRef = ref<HTMLElement>()
// 拖动实现：按住标题栏拖动面板，位移样式（含外部 transform 合并）由 useDragMove 提供；
// center 用于将面板移动到视口中心，moveTo 用于移动到任意位置（与拖动偏移共用同一套位移状态）；
// beginScreenSpaceMove / translateBy 供尺寸调整补偿位置使用
const { style: dragStyle, onHandlePointerDown, center: dragCenter, moveTo: dragMoveTo, beginScreenSpaceMove: dragBeginScreenSpaceMove, translateBy: dragTranslateBy } = useDragMove({
  target: panelRef,
  enabled: () => props.draggable,
  ignore: e => !!(e.target as HTMLElement).closest('.op-btn'),
  onDragStart: tapToTop,
  // 拖动位移变化时通知注册表（层级连线层据此重绘）
  onDragMove: () => registry.bumpLayout(),
})

// 尺寸调整：按住边缘 / 四角手柄拖动改变面板宽高；
// 尺寸写入与排列相同的 arrangedSize 通道（经样式绑定输出，窗口排列时自然恢复）
const { onHandlePointerDown: onResizeHandlePointerDown } = useDragResize({
  target: panelRef,
  enabled: () => props.resizable,
  minWidth: 240,
  minHeight: 80,
  beginScreenSpaceMove: dragBeginScreenSpaceMove,
  translateBy: dragTranslateBy,
  onResize: (width, height) => {
    arrangedSize.value = { width: `${width}px`, height: `${height}px` }
    // 尺寸变化通知注册表（层级连线层据此重绘）
    registry.bumpLayout()
  },
})

// 计算面板根节点的样式：拖动位移样式 + 排列尺寸 + 全局 z-index 动态更新
// （排列尺寸放进绑定输出：父组件传有内联样式（如 style="width: 50%"）时也能覆盖，且不会被重渲染还原）
const arrangedSize = ref<{ width?: string, height?: string }>({})
const style = computed(() => ({ ...dragStyle.value, ...arrangedSize.value, zIndex: zIndex.value }))
// 图标渲染类型：内联 svg / 图片地址 / 文本
const iconType = computed(() => resolvePanelIconType(props.icon))

const zIndexStore = useZIndexStore()
const registry = usePanelRegistryStore()
const zIndex = ref(zIndexStore.tapZIndex()) // 初始即申请一个全局 z-index
const minimized = ref(false) // 是否处于最小化状态（隐藏面板，但保留在任务栏）
// 在注册表中分配的面板 id（响应式：经 defineExpose 暴露给外部，
// 父面板把它作为 parent prop 传给子面板，从而建立层级关系）
const panelId = ref(0)

// 将面板提到最顶层（已是最顶层时不再申请，避免 z-index 无谓增长）
function tapToTop() {
  if (zIndex.value < zIndexStore.zIndex) {
    zIndex.value = zIndexStore.tapZIndex()
    registry.setActive(panelId.value)
  }
}

function highlight(value: boolean) {
  if (value) {
    panelRef.value?.classList.add('active')
  } else {
    panelRef.value?.classList.remove('active')
  }
}

// 关闭面板：由外部 v-if 控制，组件卸载时自动从任务栏移除
function close() {
  emit('close')
}

// 最小化面板：隐藏自身但保留在任务栏，可通过任务栏点击或右键菜单还原
function minimize() {
  minimized.value = true
  emit('min')
}

// 还原面板：取消最小化并置顶
function restore() {
  minimized.value = false
  zIndex.value = zIndexStore.tapZIndex()
  registry.setActive(panelId.value)
  registry.bumpLayout()
}

// 居中面板：取消最小化、移动到视口中心并置顶
async function center() {
  if (minimized.value) minimized.value = false
  zIndex.value = zIndexStore.tapZIndex()
  registry.setActive(panelId.value)
  // 等最小化状态渲染完成后，useDragMove 才能读到面板的有效矩形
  await nextTick()
  dragCenter()
  registry.bumpLayout()
}

// 排列面板到指定矩形（平铺窗口时由任务栏调用）：
// 取消最小化并置顶；width/height 提供时先设定尺寸，再把位置移动到 rect.x/y。
// 必须先改尺寸后定位：外部 transform（如 translate(-50%,-50%)）按当前尺寸解析成固定像素，
// 先移动后改尺寸会因快照位移与新尺寸的外部位移叠加错位
async function arrange(rect: { x: number, y: number, width?: number, height?: number }) {
  if (minimized.value) minimized.value = false
  zIndex.value = zIndexStore.tapZIndex()
  registry.setActive(panelId.value)
  // 尺寸经样式绑定输出（覆盖父组件的内联 width/height）
  arrangedSize.value = {
    ...(rect.width != null ? { width: `${rect.width}px` } : {}),
    ...(rect.height != null ? { height: `${rect.height}px` } : {}),
  }
  // 等最小化状态与内联尺寸渲染完成后，useDragMove 才能读到面板的有效矩形
  await nextTick()
  dragMoveTo(rect.x, rect.y)
  registry.bumpLayout()
}

// 恢复面板自然尺寸（清空排列写入的尺寸；注册表在测量类排列前调用，保证以自然尺寸为基准）
function restoreSize() {
  arrangedSize.value = {}
}

// 挂载后登记到面板注册表，任务栏即可罗列本面板
onMounted(() => {
  panelId.value = registry.register({
    title: () => props.title,
    icon: () => props.icon,
    minimized: () => minimized.value,
    parentId: () => props.parent ?? 0,
    el: () => panelRef.value,
    tapZIndex: tapToTop,
    highlight,
    minimize,
    restore,
    center,
    arrange,
    restoreSize,
    close,
  })
})

// 卸载前清理：从任务栏注销（拖动事件监听由 useDragMove 自行清理）
onBeforeUnmount(() => {
  registry.unregister(panelId.value)
})

// 暴露实例成员：id 供子面板作为 parent prop 引用；方法供父组件手动最小化 / 还原 / 居中 / 排列 / 关闭
defineExpose({ id: panelId, minimize, restore, center, arrange, close })
</script>

<style lang="scss" scoped>
// ===== 主题配色（CSS 变量） =====
// 默认：暗黑主题（绝对黑底 + 明亮高对比）；.theme-sci-fi 覆盖为蓝色科幻配色
.tool-panel {
  --panel-bg: #000000;
  --panel-backdrop: none;
  --panel-shadow: rgba(0, 0, 0, 0.8);
  --panel-outline: #ffffff;
  --title-color: #ffffff;
  --text-color: #d4d4d4;
  --header-border: rgba(255, 255, 255, 0.12);
  --header-line: linear-gradient(270deg, #ffffff00 0%, #ffffff40 15%, #ffffff99 47%, #ffffff99 82%, #ffffff00 100%);
  --header-bg: none;
  --header-bg-size: auto;
  --header-blend: normal;
  --block-1-bg: linear-gradient(180deg, #ffffff 0%, #9e9e9e 100%);
  --block-1-shadow: 0 1px 4px rgba(255, 255, 255, 0.45);
  --block-2-bg: linear-gradient(180deg, #ffffff 0%, #cfcfcf 100%);
  --block-2-shadow: 0 1px 4px rgba(255, 255, 255, 0.35);
  --op-hover-bg: rgba(255, 255, 255, 0.18);
  --op-hover-color: #ffffff;

  // 蓝色科幻主题
  &.theme-sci-fi {
    --panel-bg: linear-gradient(180deg, #071d40e6 2%, #04255ee6 100%);
    --panel-backdrop: blur(4px);
    --panel-shadow: rgba(0, 0, 0, 0.45);
    --panel-outline: #1de9ea;
    --title-color: #ffffff;
    --text-color: #c5d8f0;
    --header-border: rgba(41, 173, 255, 0.25);
    --header-line: linear-gradient(270deg, #c7edff00 0%, #c7edff66 15%, #c7edff 47%, #c7edff 82%, #c7edff00 100%);
    --header-bg: linear-gradient(90deg, rgba(41, 173, 255, 0.15) 0%, transparent 100%), url(./header-bottom-light.png) no-repeat 40px bottom;
    --header-bg-size: auto, 125px 10px;
    --header-blend: plus-lighter;
    --block-1-bg: linear-gradient(180deg, #61d8ff 0%, #29adff 100%);
    --block-1-shadow: 0 1px 4px rgba(2, 214, 254, 0.5);
    --block-2-bg: linear-gradient(180deg, #1de9ea 0%, #b7ffff 100%);
    --block-2-shadow: 0 1px 4px rgba(0, 255, 255, 0.5);
    --op-hover-bg: rgba(255, 71, 87, 0.2);
    --op-hover-color: #ff4757;
  }

  position: fixed;
  display: inline-block;
  min-width: 240px;
  padding: 0px;
  background: var(--panel-bg);
  border-radius: 4px;
  box-shadow: 0 0px 16px var(--panel-shadow);
  overflow: hidden;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  backdrop-filter: var(--panel-backdrop);
  color: var(--text-color);

  &.active {
    outline: 1px solid var(--panel-outline);
    outline-offset: 0px;
    transition: outline-color .5s ease, box-shadow .5s ease;
  }

  .panel-header {
    position: relative;
    display: flex;
    align-items: center;
    gap: 2px;
    height: 42px;
    padding: 0 12px;
    border-bottom: 1px solid var(--header-border);
    border-image: var(--header-line) 1;
    background: var(--header-bg);
    background-size: var(--header-bg-size);
    mix-blend-mode: var(--header-blend);
    user-select: none;

    &.is-draggable {
      cursor: grab;
      // 禁用触摸滚动等默认手势，避免移动端拖动被浏览器接管（触发 pointercancel）而中断
      touch-action: none;
    }

    .header-decoration {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-right: 10px;

      // 自定义图标（icon prop / #icon 插槽）
      .panel-icon {
        height: 18px;
        flex-shrink: 0;
        color: #fff;

        // 图片地址图标
        &.is-img {
          display: block;
          width: 18px;
          object-fit: contain;
        }

        // 内联 svg 图标
        &.is-svg {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;

          :deep(svg) {
            width: 100%;
            height: 100%;
          }
        }

        // 文本 / emoji 图标
        &.is-text {
          display: inline-block;
          font-size: 15px;
          line-height: 18px;
        }
      }

      .color-block {
        width: 7px;
        height: 14px;
        border-radius: 2px;
        transform: skewX(-18deg);

        &.block-1 {
          background: var(--block-1-bg);
          box-shadow: var(--block-1-shadow);
        }

        &.block-2 {
          background: var(--block-2-bg);
          box-shadow: var(--block-2-shadow);
        }
      }
    }

    .panel-title {
      flex: 1;
      font-family: "Kaiti SC", "STKaiti", KaiTi, "KaiTi TC", "BiauKai", "DFKai-SB", cursive, serif;
      font-size: 20px;
      font-weight: 400;
      line-height: 16px;
      letter-spacing: 0px;
      color: var(--title-color);
    }

    .op-btn {
      width: 20px;
      height: 20px;
      overflow: hidden;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover {
        background: var(--op-hover-bg);
        color: var(--op-hover-color);
        cursor: pointer;
      }
    }
  }

  .panel-body {
    padding: 14px;
  }

  // 尺寸调整手柄：贴边的透明热区，光标随方向变化（Windows 风格八方向调整）
  .resize-handle {
    position: absolute;
    z-index: 2147483646;
    // 禁用触摸滚动等默认手势，避免移动端拖拽被浏览器接管而中断
    touch-action: none;
    // 缩放处理：如果尺寸调整不易触发，可缩放处理
    transform: scale(1.5);

    &.n { top: 0; left: 10px; right: 10px; height: 5px; cursor: n-resize; }
    &.s { bottom: 0; left: 10px; right: 10px; height: 5px; cursor: s-resize; }
    &.e { top: 10px; bottom: 10px; right: 0; width: 5px; cursor: e-resize; }
    &.w { top: 10px; bottom: 10px; left: 0; width: 5px; cursor: w-resize; }
    &.ne { top: 0; right: 0; width: 12px; height: 12px; cursor: ne-resize; }
    &.nw { top: 0; left: 0; width: 12px; height: 12px; cursor: nw-resize; }
    &.se { bottom: 0; right: 0; width: 12px; height: 12px; cursor: se-resize; }
    &.sw { bottom: 0; left: 0; width: 12px; height: 12px; cursor: sw-resize; }
  }
}
</style>