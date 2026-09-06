import type { App, ObjectPlugin } from 'vue'
import ToolPanel from "./tool-panel/ToolPanel.vue"

// 以数组的结构保存组件，便于遍历
const components = [
    ToolPanel
]

// 插件安装函数
const plugin: ObjectPlugin<any[]> = {
    install(app: App, ...options) {
        components.forEach(component => {
            const name = component.name || component.__name;
            console.log({ options })
            if (name) {
                app.component(name, component)
            }
        })
    }
}

export {
    plugin,
}