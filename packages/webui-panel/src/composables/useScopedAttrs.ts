import { getCurrentInstance, computed } from 'vue'

/** 获取当前组件的 scoped 属性 */
export function useScopedAttrs() {
  const scopeId = getCurrentInstance()?.vnode?.scopeId
  return computed(() => (scopeId ? { [scopeId]: '' } : {}))
}