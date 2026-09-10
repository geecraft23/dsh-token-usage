import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { client: 'src/client/index.tsx' }, outDir: 'lib', format: 'cjs',
  platform: 'browser', target: 'es2024', dts: false, clean: false,
  deps: { alwaysBundle: ['zod'], neverBundle: ['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/cordis'] },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: 'window.__ModuleLoader__.load({ id: "@geecraft23/dsh-token-usage", factory: (require) => {',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    footer: 'return module.exports; } });',
  },
})
