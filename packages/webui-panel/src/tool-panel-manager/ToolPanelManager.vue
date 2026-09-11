<template>
  <div class="tool-panel-manager">
    <!-- 任务栏：罗列所有面板实例 -->
    <div
      v-for="panel in registry.panels"
      :key="panel.id"
      class="taskbar-item"
      :class="{ active: panel.id === registry.activeId }"
      :title="panel.title()"
      @click="registry.tapPanel(panel.id)"
      @contextmenu.prevent.stop="openMenu($event, panel.id)"
    >
      <span class="color-block block-1"></span>
      <span class="color-block block-2"></span>
      <span class="taskbar-title">{{ panel.title() }}</span>
    </div>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div v-if="menu.visible" class="context-menu" :style="{ left: `${menu.x}px`, top: `${menu.y}px` }">
        <div class="menu-item" @click="onCloseWindow">关闭窗口</div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, reactive, watch } from 'vue'
import { usePanelRegistryStore } from './panel-registry'

const registry = usePanelRegistryStore()

// 右键菜单状态
const menu = reactive({ visible: false, x: 0, y: 0, panelId: 0 })

function openMenu(e: MouseEvent, panelId: number) {
  menu.panelId = panelId
  // 防止菜单超出视口
  menu.x = Math.min(e.clientX, window.innerWidth - 152)
  menu.y = Math.min(e.clientY, window.innerHeight - 42)
  menu.visible = true
}

function hideMenu() {
  menu.visible = false
}

function onCloseWindow() {
  registry.closePanel(menu.panelId)
  hideMenu()
}

// 点击任意处或再次右键时关闭菜单
watch(() => menu.visible, (visible) => {
  if (visible) {
    document.addEventListener('click', hideMenu)
    document.addEventListener('contextmenu', hideMenu)
  } else {
    document.removeEventListener('click', hideMenu)
    document.removeEventListener('contextmenu', hideMenu)
  }
})

onBeforeUnmount(() => {
  hideMenu()
})
</script>

<style lang="scss" scoped>
.tool-panel-manager {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2147483646;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 8px;
  background: linear-gradient(180deg, #071d40f2 2%, #04255ef2 100%);
  border-top: 1px solid rgba(90, 140, 255, 0.45);
  backdrop-filter: blur(4px);
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;

  .taskbar-item {
    height: 30px;
    max-width: 160px;
    padding: 0 14px;
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(41, 173, 255, 0.12);
    border: 1px solid rgba(90, 140, 255, 0.35);
    border-radius: 4px;
    font-size: 12px;
    color: #c5d8f0;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s;

    &:hover {
      background: rgba(41, 173, 255, 0.25);
    }

    &.active {
      background: rgba(41, 173, 255, 0.35);
      color: #fff;
    }

    .color-block {
      width: 7px;
      height: 12px;
      border-radius: 2px;
      transform: skewX(-18deg);
      flex-shrink: 0;

      &.block-1 {
        background: linear-gradient(180deg, #61d8ff 0%, #29adff 100%);
      }

      &.block-2 {
        background: linear-gradient(180deg, #1de9ea 0%, #b7ffff 100%);
      }
    }

    .taskbar-title {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  }
}

.context-menu {
  position: fixed;
  min-width: 140px;
  padding: 4px;
  background: #0a2450f2;
  border: 1px solid #5A8CFF;
  border-radius: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  z-index: 2147483647;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;

  .menu-item {
    padding: 6px 12px;
    border-radius: 3px;
    font-size: 13px;
    color: #c5d8f0;
    cursor: pointer;
    user-select: none;

    &:hover {
      background: rgba(41, 173, 255, 0.3);
      color: #fff;
    }
  }
}
</style>
