<template>
  <Teleport to="body">
    <!-- 面板根节点：v-show 控制显隐（关闭或最小化时隐藏），主题类名切换配色变量 -->
    <div v-show="visible && !minimized" ref="panelRef" class="panel" :class="`theme-${theme}`" :style="style" v-bind="{ ...attrs, ...scoped }">
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
          <div class="op-btn setting"@click="emit('setting')" v-if="btns.includes('setting')">
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
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, Teleport, useAttrs } from 'vue'
import { useZIndexStore } from './z-index'
import { usePanelRegistryStore } from '../tool-panel-manager/panel-registry'
import { resolvePanelIconType } from './icon'
import { useScopedAttrs } from '@/composables/useScopedAttrs';
import { useDragMove } from '@/composables/useDragMove'

type SideButton = 'setting' | 'menu' | 'min' | 'close'

// 组件属性：标题、显示哪些操作按钮、是否可拖动、面板图标
const props = withDefaults(defineProps<{
  title: string
  btns?: SideButton[]
  draggable?: boolean
  /** 面板图标：内联 svg 字符串 / 图片地址（http、data、相对路径等）/ emoji 等文本；为空时显示默认色块，任务栏同步显示。内联 svg 通过 v-html 渲染，请勿传入不可信内容 */
  icon?: string
  /** 主题：'dark' 绝对黑暗黑风格（默认）；'sci-fi' 蓝色科幻风格 */
  theme?: 'dark' | 'sci-fi'
}>(), {
  btns: () => ['setting', 'menu', 'min', 'close'],
  draggable: true,
  icon: '',
  theme: 'dark',
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
// center 用于将面板移动到视口中心（与拖动偏移共用同一套位移状态）
const { style: dragStyle, onHandlePointerDown, center: dragCenter } = useDragMove({
  target: panelRef,
  enabled: () => props.draggable,
  ignore: e => !!(e.target as HTMLElement).closest('.op-btn'),
  onDragStart: tapToTop,
})

// 计算面板根节点的样式：拖动位移样式 + 全局 z-index 动态更新
const style = computed(() => ({ ...dragStyle.value, zIndex: zIndex.value }))
// 图标渲染类型：内联 svg / 图片地址 / 文本
const iconType = computed(() => resolvePanelIconType(props.icon))

const zIndexStore = useZIndexStore()
const registry = usePanelRegistryStore()
const zIndex = ref(zIndexStore.tapZIndex()) // 初始即申请一个全局 z-index
const visible = ref(true) // 面板是否可见（关闭后隐藏并退出任务栏）
const minimized = ref(false) // 是否处于最小化状态（隐藏面板，但保留在任务栏）
let panelId = 0 // 在注册表中分配的面板 id

// 将面板提到最顶层（已是最顶层时不再申请，避免 z-index 无谓增长）
function tapToTop() {
  if (zIndex.value < zIndexStore.zIndex) {
    zIndex.value = zIndexStore.tapZIndex()
    registry.setActive(panelId)
  }
}

function highlight(value: boolean) {
  if (value) {
    panelRef.value?.classList.add('active')
  } else {
    panelRef.value?.classList.remove('active')
  }
}

// 关闭面板：隐藏自身、从任务栏移除，并通知父组件
function close() {
  visible.value = false
  registry.unregister(panelId)
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
  registry.setActive(panelId)
}

// 居中面板：取消最小化、移动到视口中心并置顶
async function center() {
  if (minimized.value) minimized.value = false
  zIndex.value = zIndexStore.tapZIndex()
  registry.setActive(panelId)
  // 等最小化状态渲染完成后，useDragMove 才能读到面板的有效矩形
  await nextTick()
  dragCenter()
}

// 挂载后登记到面板注册表，任务栏即可罗列本面板
onMounted(() => {
  panelId = registry.register({
    title: () => props.title,
    icon: () => props.icon,
    minimized: () => minimized.value,
    tapZIndex: tapToTop,
    highlight,
    minimize,
    restore,
    center,
    close,
  })
})

// 卸载前清理：从任务栏注销（拖动事件监听由 useDragMove 自行清理）
onBeforeUnmount(() => {
  registry.unregister(panelId)
})

// 暴露实例方法：父组件可通过模板 ref 手动最小化 / 还原 / 居中 / 关闭
defineExpose({ minimize, restore, center, close })
</script>

<style lang="scss" scoped>
// ===== 主题配色（CSS 变量） =====
// 默认：暗黑主题（绝对黑底 + 明亮高对比）；.theme-sci-fi 覆盖为蓝色科幻配色
.panel {
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
}
</style>