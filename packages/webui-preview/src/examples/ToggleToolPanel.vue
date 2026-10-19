<script setup lang="ts">
import { ToolPanel } from '@develon/webui-panel'
import logo from '@/assets/icons/build.svg'
import { ref } from 'vue'

const showPanel = ref(true)
const panelRef = ref<InstanceType<typeof ToolPanel> | null>(null)

const toggleShowPanel = () => {
  showPanel.value = !showPanel.value
}
</script>

<template>
  <main>
    <ToolPanel v-if="showPanel" ref="panelRef" class="panel1" title="Tool Panel" :icon="logo" @close="toggleShowPanel">
      <h1>Hello Tool Panel!</h1>
    </ToolPanel>

    <ToolPanel theme="sci-fi" class="panel2" title="Tool Panel Control" :icon="logo" :parent="panelRef?.id">
      <button @click="toggleShowPanel">Toggle</button>
    </ToolPanel>
  </main>
</template>

<style scoped>
.panel1 {
  width: 300px;
}

.panel2 {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
