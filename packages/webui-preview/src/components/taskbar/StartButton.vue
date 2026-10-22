<script setup lang="ts">
import IconStart from '@/assets/icons/start.svg?component'
</script>

<template>
  <button class="prepend-content">
    <IconStart class="icon-start" />
    <span>WebUI</span>
  </button>
</template>

<style scoped lang="scss">
.prepend-content {
  display: flex;
  margin-right: auto;
  align-items: center;

  .icon-start {
    width: 20px;
    height: 20px;
  }
}
</style>
