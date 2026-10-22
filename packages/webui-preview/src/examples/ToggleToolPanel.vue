<script setup lang="ts">
import { ToolPanel } from '@develon/webui-panel'
import logo from '@/assets/icons/build.svg?url'
import { ref } from 'vue'

const showPanel = ref(true)
const panelRef = ref<InstanceType<typeof ToolPanel>>()

const toggleShowPanel = () => {
  showPanel.value = !showPanel.value
}
</script>

<template>
  <main>
    <ToolPanel v-if="showPanel" ref="panelRef" class="panel1" title="Tool Panel" :icon="logo" @close="toggleShowPanel">
      <div class="image-container">
        <h1>Scale me!</h1>
        <img :src="logo">
      </div>
    </ToolPanel>

    <ToolPanel theme="sci-fi" class="panel2" title="Tool Panel Control" :icon="logo" :parent="panelRef?.id">
      <button @click="toggleShowPanel">Toggle</button>
    </ToolPanel>
  </main>
</template>

<style scoped>
.panel1 {
  width: 200px;

  .image-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    img {
      width: 50%;
      height: 50%;
    }
  }
}

.panel1, .panel2 {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
