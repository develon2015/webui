<template>
  <div ref="panelRef" class="panel" :style="{ transform: `translate(${offset.x}px, ${offset.y}px)` }">
    <div class="panel-header" :class="{ 'is-draggable': draggable }" @pointerdown="onHeaderPointerDown">
      <div class="header-decoration">
        <span class="color-block block-1"></span>
        <span class="color-block block-2"></span>
      </div>
      <!-- 面板标题 -->
      <slot name="title">
        <span class="panel-title">{{ title }}</span>
      </slot>
      <!-- 操作按钮组 -->
      <slot name="op">
        <div class="op-btn setting"@click="emit('setting')" v-if="btns.includes('setting')">
          <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" style="color:#fff"><defs><g id="t"><rect x="-6" y="-32" width="12" height="14" rx="2" fill="currentColor"/></g></defs><g transform="translate(50,50)"><circle r="22" fill="currentColor"/><use href="#t"/><use href="#t" transform="rotate(45)"/><use href="#t" transform="rotate(90)"/><use href="#t" transform="rotate(135)"/><use href="#t" transform="rotate(180)"/><use href="#t" transform="rotate(225)"/><use href="#t" transform="rotate(270)"/><use href="#t" transform="rotate(315)"/><circle r="12" fill="#34495e"/></g></svg>
        </div>
        <div class="op-btn menu" @click="emit('menu')" v-if="btns.includes('menu')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" style="color:#fff"><defs><g id="item" fill="currentColor"><ellipse cx="2.5" cy="3.167" rx="0.833" ry="0.833"/><path d="M13.833,3.666 L5.103,3.666 A0.5,0.5 0 0,0 5.103,2.666 L13.833,2.666 Z"/></g></defs><use href="#item"/><use href="#item" transform="translate(0,4.666)"/><use href="#item" transform="translate(0,9.666)"/></svg>
        </div>
        <div class="op-btn min" @click="emit('min')" v-if="btns.includes('min')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" style="color: #fff"><rect x="2.1667" y="7.6667" width="11.6667" height="1" rx="0.5" fill="currentColor"/></svg>
        </div>
        <div class="op-btn close" @click="emit('close')" v-if="btns.includes('close')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" style="color: #fff"><path d="M14.1871 13.1265L13.1265 14.1872L1.81275 2.87347L2.87341 1.81281L14.1871 13.1265Z" fill="currentColor"></path><path d="M13.1265 1.81282L14.1871 2.87348L2.8734 14.1872L1.81274 13.1265L13.1265 1.81282Z" fill="currentColor"></path></svg>
        </div>
      </slot>
    </div>
    <div class="panel-body">
      <slot name="default"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onBeforeUnmount } from 'vue'

type SideButton = 'setting' | 'menu' | 'min' | 'close'

const props = withDefaults(defineProps<{
  title: string
  btns?: SideButton[]
  draggable?: boolean
}>(), {
  btns: () => ['setting', 'menu', 'min', 'close'],
  draggable: true,
})

const emit = defineEmits<{
  menu: []
  min: []
  close: []
  setting: []
}>()

// 拖动偏移量
const panelRef = ref<HTMLElement>()
const offset = reactive({ x: 0, y: 0 })
let [startX, startY, startOffsetX, startOffsetY] = [0, 0, 0, 0]
let [minOffsetX, maxOffsetX, minOffsetY, maxOffsetY] = [0, 0, 0, 0]
let dragging = false

function onPointerMove(e: PointerEvent) {
  if (!dragging) return
  offset.x = clamp(startOffsetX + (e.clientX - startX), minOffsetX, maxOffsetX)
  offset.y = clamp(startOffsetY + (e.clientY - startY), minOffsetY, maxOffsetY)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function onPointerUp() {
  dragging = false
  document.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointerup', onPointerUp)
  document.removeEventListener('pointercancel', onPointerUp)
  document.body.style.userSelect = ''
}

function onHeaderPointerDown(e: PointerEvent) {
  if (!props.draggable) return
  const target = e.target as HTMLElement
  if (target.closest('.op-btn')) return

  const el = panelRef.value
  if (!el) return

  // 根据面板当前位置与视口尺寸，计算本次拖动的偏移范围，防止面板拖出视口
  const rect = el.getBoundingClientRect()
  const baseLeft = rect.left - offset.x
  const baseTop = rect.top - offset.y
  minOffsetX = -baseLeft
  maxOffsetX = window.innerWidth - rect.width - baseLeft
  minOffsetY = -baseTop
  maxOffsetY = window.innerHeight - rect.height - baseTop
  // 面板尺寸超出视口时，取值区间会倒置，统一交换保证 clamp 有效
  ;[minOffsetX, maxOffsetX] = [Math.min(minOffsetX, maxOffsetX), Math.max(minOffsetX, maxOffsetX)]
  ;[minOffsetY, maxOffsetY] = [Math.min(minOffsetY, maxOffsetY), Math.max(minOffsetY, maxOffsetY)]

  dragging = true
  ;[startX, startY, startOffsetX, startOffsetY] = [e.clientX, e.clientY, offset.x, offset.y]
  document.body.style.userSelect = 'none'
  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', onPointerUp)
  document.addEventListener('pointercancel', onPointerUp)
}

onBeforeUnmount(() => {
  onPointerUp()
})
</script>

<style lang="scss" scoped>
$panel-bg: linear-gradient(180deg, #071d40e6 2%, #04255ee6 100%);
$panel-border: #5A8CFF;
$title-color: #ffffff;
$text-color: #c5d8f0;

.panel {
  min-width: 240px;
  padding: 0px;
  background: $panel-bg;
  border: 2px solid $panel-border;
  border-radius: 4px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  backdrop-filter: blur(4px);
  color: $text-color;

  .panel-header {
    position: relative;
    display: flex;
    align-items: center;
    gap: 2px;
    height: 42px;
    padding: 0 12px;
    border-bottom: 1px solid rgba(41, 173, 255, 0.25);
    border-image: linear-gradient(270deg, #c7edff00 0%, #c7edff66 15%, #c7edff 47%, #c7edff 82%, #c7edff00 100%) 1;
    background:
      linear-gradient(90deg, rgba(41, 173, 255, 0.15) 0%, transparent 100%),
      url(./header-bottom-light.png) no-repeat 40px bottom;
    background-size: auto, 125px 10px;
    mix-blend-mode: plus-lighter;
    user-select: none;

    &.is-draggable {
      cursor: grab;
      touch-action: none;
    }

    .header-decoration {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-right: 10px;

      .color-block {
        width: 7px;
        height: 14px;
        border-radius: 2px;
        transform: skewX(-18deg);

        &.block-1 {
          background: linear-gradient(180deg, #61d8ff 0%, #29adff 100%);
          box-shadow: 0 1px 4px rgba(2, 214, 254, 0.5);
        }

        &.block-2 {
          background: linear-gradient(180deg, #1de9ea 0%, #b7ffff 100%);
          box-shadow: 0 1px 4px rgba(0, 255, 255, 0.5);
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
      color: $title-color;
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
        background: rgba(255, 71, 87, 0.2);
        border-color: #ff4757;
        color: #ff4757;
        cursor: pointer;
      }
    }
  }

  .panel-body {
    padding: 14px;
  }
}
</style>