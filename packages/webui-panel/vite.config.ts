import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'unplugin-dts/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue({
      features: {
        customElement: /.ce.vue$/, // 将文件名匹配的 Vue SFC 转换为自定义元素，默认值: /.ce.vue$/
      },
    }),
    dts({
      bundleTypes: true, // 在生成类型声明文件后，是否对其进行打包
      tsconfigPath: './tsconfig.lib.json', // 从 tsconfig 中解析 include 和 exclude 规则
      insertTypesEntry: true, // 是否使用 package.json 中的 types 字段, 如果不存在则使用 ${outDir}/index.d.ts
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    lib: {
      entry: './src/index.ts',
      name: 'WebuiPanel',
      fileName: 'index',
      formats: ['es'],
    },
    rolldownOptions: {
      external: ['vue'], // 指定哪些模块应视为外部模块而不是捆绑的。外部模块将作为导入语句保留在输出中。
      output: {
        globals: {
          vue: 'Vue', // 指定 umd / iife 格式的外部导入所需的 id:variableName 对。
        },
      },
    },
  }
})
