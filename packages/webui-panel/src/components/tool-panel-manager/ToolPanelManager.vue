<template>
  <div class="tool-panel-manager">
    <!-- 任务栏：罗列所有面板实例 -->
    <div
      v-for="panel in registry.panels"
      :key="panel.id"
      class="taskbar-item"
      :class="{ active: panel.id === registry.activeId && !panel.minimized(), minimized: panel.minimized() }"
      :title="panel.title()"
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

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div v-if="menu.visible" class="context-menu" :style="{ left: `${menu.x}px`, top: `${menu.y}px` }">
        <!-- 菜单项随面板最小化状态切换：最小化窗口 / 还原窗口 -->
        <div v-if="isMenuPanelMinimized()" class="menu-item" @click="onRestoreWindow">还原窗口</div>
        <div v-else class="menu-item" @click="onMinimizeWindow">最小化窗口</div>
        <div class="menu-item" @click="onCloseWindow">关闭窗口</div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, reactive, watch } from 'vue'
import { usePanelRegistryStore, type PanelEntry } from './panel-registry'
import { resolvePanelIconType } from '../tool-panel/icon'

// 面板注册表：任务栏的数据源
const registry = usePanelRegistryStore()

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

// 菜单所指向的面板是否处于最小化状态
function isMenuPanelMinimized() {
  return registry.panels.find(panel => panel.id === menu.panelId)?.minimized() ?? false
}

// 任务栏点击：还原已最小化面板并置顶；点击当前激活面板则最小化（类 Windows 行为）；否则置顶
function onTaskItemClick(panel: PanelEntry) {
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

// 卸载时关闭菜单，watch 随之移除全局监听
onBeforeUnmount(() => {
  hideMenu()
})
</script>

<style lang="scss" scoped>
// 任务栏：类似 Windows 状态栏，固定在视口底部
.tool-panel-manager {
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

    // 最小化的面板：弱化显示
    &.minimized {
      opacity: 0.55;
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

// 右键菜单：Teleport 到 body 渲染，避免受任务栏层叠上下文影响
.context-menu {
  position: fixed;
  min-width: 140px;
  padding: 4px;
  background: #0a2450f2;
  border: 1px solid #5A8CFF;
  border-radius: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  // 需盖过任务栏
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
