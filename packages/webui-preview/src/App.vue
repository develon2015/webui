<script setup lang="ts">
import { ToolPanel } from '@develon/webui-panel'
</script>

<template>
  <h1>You did it!</h1>
  <div>
    <ToolPanel title="构建工具" class="panel">
      <div class="content">
        <button>构建</button>
        <button>清理</button>
      </div>
    </ToolPanel>
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
