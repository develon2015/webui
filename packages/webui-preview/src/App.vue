<script setup lang="ts">
import { ToolPanelManager } from '@develon/webui-panel'
import KanShiDemo from './examples/KanShiDemo.vue'
import ToggleToolPanel from './examples/ToggleToolPanel.vue'
import VerticalToolPanelManager from './examples/VerticalToolPanelManager.vue'
import GithubLink from './components/taskbar/GithubLink.vue'
import StartButton from './components/taskbar/StartButton.vue'
</script>

<template>
  <KanShiDemo />
  <ToggleToolPanel />
  <VerticalToolPanelManager />

  <ToolPanelManager theme="sci-fi">
    <template #prepend>
      <StartButton />
    </template>
    <template #append>
      <GithubLink />
    </template>
  </ToolPanelManager>
</template>
