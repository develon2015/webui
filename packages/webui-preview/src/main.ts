import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import '@develon/webui-panel/dist/index.css'
// import { plugin } from '@develon/webui-panel'

const app = createApp(App)

app.use(createPinia())
// app.use(plugin)

app.mount('#app')
