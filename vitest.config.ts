import {defineConfig,configDefaults} from 'vitest/config'

export default defineConfig({
  test:{
    exclude:[...configDefaults.exclude,'**/*.node.test.mjs','tests/editorial-run.test.mjs','tests/public-egress-guards.test.mjs'],
  },
})
