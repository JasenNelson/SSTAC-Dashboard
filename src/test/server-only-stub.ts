// Vitest-only no-op replacement for the `server-only` package.
//
// `server-only` is a build-time tripwire: when Next.js bundles a module
// that contains `import 'server-only'` into a client chunk, the import
// throws and the build fails -- preventing server-only code (like
// node-pty probes, database clients, etc.) from leaking into the browser.
//
// Vitest runs in jsdom with no Next runtime, so the real package throws
// on import even from legitimate server-only test files. Aliasing to this
// empty module lets the imports succeed; the real Next.js production
// build still gets the protection.
export {};
