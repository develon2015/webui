<script setup lang="ts">
import { ToolPanel, ToolPanelManager } from '@develon/webui-panel'
import buildIcon from '@/assets/icons/build.svg'
import debugIcon from '@/assets/icons/debug.svg'
import { onMounted, ref } from 'vue'

const toolPanelManagerRef = ref<InstanceType<typeof ToolPanelManager>>()

onMounted(() => {
  toolPanelManagerRef.value?.showAllWindows()
})
</script>

<template>
  <div>
    <ToolPanel title="窗口管理" class="panel" style="width: 50%; height: 300px;">
      <ToolPanelManager theme="sci-fi"></ToolPanelManager>
    </ToolPanel>

    <ToolPanel theme="sci-fi" :icon="buildIcon" title="这是一个非常长的标题，尝试调整面板宽度以观察其变化" class="panel">
      <div class="content">
        <span>它在宽度非常冗余时应该会显示在一行内，宽度较小时会换行显示且长度相当，宽度不足时溢出部分仍可滚动查看</span>
      </div>
    </ToolPanel>

    <ToolPanel theme="dark" :icon="debugIcon" title="测试工具" class="panel">
      <div class="content">
        <button>测试</button>
        <button>调试</button>
      </div>
    </ToolPanel>

    <ToolPanelManager ref="toolPanelManagerRef" theme="dark" mode="vertical" class="panel-manager"></ToolPanelManager>
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
    height: 100%;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
}

.panel-manager {
  height: calc(100vh - 41px - 16px) !important;
}
</style>
