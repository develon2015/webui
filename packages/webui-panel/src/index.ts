/**
 * webui-panel 组件库入口：统一注册与导出所有组件
 */
import type { App, ObjectPlugin } from 'vue'
import ToolPanel from './components/tool-panel/ToolPanel.vue'
import ToolPanelManager from './components/tool-panel-manager/ToolPanelManager.vue'

// 以数组的结构保存组件，便于遍历
const components = [
    ToolPanel,
    ToolPanelManager,
]

/**
 * 插件安装函数：app.use(plugin) 后所有组件注册为全局组件
 */
const plugin: ObjectPlugin<any[]> = {
    install(app: App, ...options) {
        components.forEach(component => {
            // <script setup> 组件没有显式 name，Vue 会将文件名写入 __name
            const name = component.name || component.__name
            console.log('install component:', name, options)
            if (name) {
                app.component(name, component)
            }
        })
    }
}

export {
    plugin,
    ToolPanel,
    ToolPanelManager,
}