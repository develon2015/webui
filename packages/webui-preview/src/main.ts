import { createApp, defineCustomElement } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import '@develon/webui-panel/dist/index.css'
// import { ToolPanel } from '@develon/webui-panel'
// import { plugin } from '@develon/webui-panel'

const app = createApp(App)

app.use(createPinia())
// app.use(plugin)

app.mount('#app')

// 测试 Web Component 注册
/*
// 1. 转换 Vue 组件为 Web Component 构造函数
const MyElement = defineCustomElement(ToolPanel)
// 2. 注册为浏览器可识别的自定义元素
customElements.define('tool-panel', MyElement)
*/
