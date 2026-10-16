# dev
```
npm run build:watch
```

# usage
* main.ts
```
import { createApp } from 'vue'
import App from './App.vue'

// 配置 pinia
import { createPinia } from 'pinia'
// 引入样式
import '@develon/webui-panel/dist/index.css'

createApp(App).use(createPinia()).mount('#app')
```
* App.vue
```
<script setup lang="ts">
import { ToolPanel, ToolPanelManager } from '@develon/webui-panel'
import logo from '@/assets/logo.svg'
import { ref } from 'vue'

const showPanel = ref(true)

const toggleShowPanel = () => {
  showPanel.value = !showPanel.value
}
</script>

<template>
  <main>
    <ToolPanel v-if="showPanel" class="panel1" title="Tool Panel" :icon="logo" @close="toggleShowPanel">
      <h1>Hello Tool Panel!</h1>
    </ToolPanel>

    <ToolPanel theme="sci-fi" class="panel2" title="Tool Panel Control" :icon="logo">
      <button @click="toggleShowPanel">Toggle</button>
    </ToolPanel>

    <ToolPanelManager theme="sci-fi" />
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
```