<script setup lang="ts">
import { ToolPanel, ToolPanelManager } from '@develon/webui-panel'
import buildIcon from '@/assets/icons/build.svg'
import debugIcon from '@/assets/icons/debug.svg'
</script>

<template>
  <div>
    <ToolPanel :icon="buildIcon" title="构建工具" class="panel">
      <div class="content">
        <button>构建</button>
        <button>清理</button>
      </div>
    </ToolPanel>

    <ToolPanel :icon="debugIcon" title="测试工具" class="panel">
      <div class="content">
        <button>测试</button>
        <button>调试</button>
      </div>
    </ToolPanel>

    <ToolPanelManager></ToolPanelManager>
  </div>
</template>

<style scoped lang="scss">
.panel {
  width: 400px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);

  .content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
}
</style>
