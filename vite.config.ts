import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'EnzymeToRTL',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format}.js`
    }
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  }
})
