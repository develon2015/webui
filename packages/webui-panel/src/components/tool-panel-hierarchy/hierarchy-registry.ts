/**
 * 层级连线组件注册表
 * ToolPanelHierarchy 实例挂载时在此登记；多个实例同时存在时仅 id 列表第一个绘制画布，
 * 其卸载后由后续实例自动接管
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useHierarchyRegistryStore = defineStore('tool-panel-hierarchy-registry', () => {
    // 实例 id 发号器
    let nextId = 1
    // 已挂载的层级连线组件实例 id 列表：仅列表第一个实例绘制画布，其卸载后由后续实例自动接管
    const instanceIds = ref<number[]>([])
    // 列表中第一个实例的 id（0 表示暂无实例）
    const firstInstanceId = computed(() => instanceIds.value[0] ?? 0)

    /** 登记层级连线组件实例，返回分配的实例 id */
    function register() {
        const id = nextId++
        instanceIds.value.push(id)
        return id
    }

    /** 注销层级连线组件实例（组件卸载时调用） */
    function unregister(id: number) {
        instanceIds.value = instanceIds.value.filter(x => x !== id)
    }

    return { instanceIds, firstInstanceId, register, unregister }
})
