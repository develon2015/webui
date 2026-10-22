<script setup lang="ts">
import IconGithub from '@/assets/icons/github.svg?component'
</script>

<template>
  <div class="append-content">
    <a href="https://github.com/develon2015/webui" target="_blank">
      <IconGithub class="icon-github" />
    </a>
  </div>
</template>

<style scoped lang="scss">
.append-content {
  display: flex;
  // 把元素尽可能地推到父容器的右侧
  margin-left: auto;
  // 而 flex 和 width 都会改变当前元素的宽度
  // flex: 1;
  // width: 100%;
  // justify-content: end;
  align-items: center;
  
  .icon-github {
    filter: invert(1);
  }
}
</style>
