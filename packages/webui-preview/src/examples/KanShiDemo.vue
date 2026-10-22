<script setup lang="ts">
import { ref } from 'vue'
import { ToolPanel, ToolPanelHierarchy } from '@develon/webui-panel'
import debugIcon from '@/assets/icons/debug.svg'

const panelRef = ref<InstanceType<typeof ToolPanel>>()

const arts = [
  {
    title: '辞世文 - 日野俊基',
    content: String.raw`
      古来の一句
      死も無し生も無し
      万里雲尽きて
      長江水清し
    `
  },
  {
    title: '敦盛 - 织田信长',
    content: String.raw`
      人間五十年
      下天のうちをくらぶれば
      夢幻の如くなり
      一度生を得て
      滅せぬもののあるべきか
    `.repeat(10)
  },
  {
    title: '辞世文 - 明智光秀',
    content: String.raw`
      順逆無二門
      大道徹心源
      五十五年夢
      覚来帰一元
    `
  }
]
arts.forEach(it => it.content = it.content.split('\n').filter(it => it.trim() != '').join('\n'))
</script>

<template>
  <div>
    <ToolPanel ref="panelRef" theme="dark" :icon="debugIcon" title="汉诗" class="parent-panel">
    </ToolPanel>

    <ToolPanel theme="dark" :icon="debugIcon" :title="art.title" class="panel" v-for="art in arts" :key="art.title" :parent="panelRef?.id">
      <div class="content">
        <div class="art">{{ art.content }}</div>
      </div>
    </ToolPanel>

    <!-- <ToolPanelHierarchy /> -->
  </div>
</template>

<style scoped lang="scss">
@font-face {
  font-family: 'Furifont';
  src: url('https://furifont.antfu.me/fonts/FurifontSansVF.woff2?v=0.5.1') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

.parent-panel {
  width: 400px;
  top: 20%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.panel {
  width: 400px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);

  .content {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .art {
      font-family: 'Furifont';
      font-size: 20px;
      white-space: pre;
    }
  }
}
</style>
