// vite-plugin-static-copy ships a package.json "types" field pointing at a
// file its published dist/ doesn't actually contain — minimal local shim.
declare module 'vite-plugin-static-copy' {
  import type { Plugin } from 'vite';

  export interface StaticCopyTarget {
    src: string;
    dest: string;
  }

  export interface StaticCopyOptions {
    targets: StaticCopyTarget[];
  }

  export function viteStaticCopy(options: StaticCopyOptions): Plugin;
}
