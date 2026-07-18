import { defineConfig } from "vitest/config";

// Vitest's config-level `test.exclude` applies unconditionally: even an
// explicit `vitest run test/rules` CLI path filter cannot pull files back in
// once a matching glob is excluded here. So `test/rules/**` and
// `test/rateLimit.test.ts` are only added to the exclude list for the bare
// `npm test` run; `npm run test:rules` / `npm run test:emulated` set
// VITEST_RULES=true (see package.json) to opt back in, since those tests need
// the Firestore/Storage/Auth emulators from `firebase emulators:exec` and
// would otherwise fail under plain `vitest run`.
const isRulesRun = process.env.VITEST_RULES === "true";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
      ...(isRulesRun ? [] : ["test/rules/**", "test/rateLimit.test.ts"]),
    ],
  },
});
