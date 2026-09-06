<template>
  <div class="tool-panel">
    <div class="tool-panel__header">
      <span class="tool-panel__accent"></span>
      <span class="tool-panel__title">{{ title }}</span>
    </div>
    <div class="tool-panel__content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
    title: string
}>(), {
    title: 'Tool Panel'
})
</script>

<style scoped lang="scss">
.tool-panel {
  --tool-panel-radius: 10px;
  --tool-panel-border: 1px solid #e4e7ed;
  --tool-panel-primary: #007bff;

  display: inline-block;
  border: var(--tool-panel-border);
  border-radius: var(--tool-panel-radius);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: linear-gradient(180deg, var(--tool-panel-primary), #f7f9fc);
    border-bottom: 1px solid #ebeef5;
  }

  &__accent {
    width: 4px;
    height: 14px;
    border-radius: 2px;
    background: linear-gradient(180deg, #007bff, #0056b3);
  }

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
    line-height: 1.4;
  }

  &__content {
    padding: 16px;
    color: #606266;
    font-size: 14px;
    line-height: 1.6;
  }
}
</style>