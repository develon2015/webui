<script setup lang="ts">
import { ToolPanel, ToolPanelManager } from '@develon/webui-panel'
</script>

<template>
  <div>
    <ToolPanel title="构建工具" class="panel">
      <div class="content">
        <button>构建</button>
        <button>清理</button>
      </div>
    </ToolPanel>

    <ToolPanel title="测试工具" class="panel">
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

  .content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
}
</style>
