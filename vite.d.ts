// vite.config.ts 在构建期要把 uglify-js 的 lib/*.js 读出来拼成一个模块（原因见那里的注释），
// 于是用到了 Node 的几个接口。这里只补真正用到的那几个，不引入 @types/node：
// 那个包会把 process、Buffer 这类浏览器端并不存在的全局类型也带进 src/。

declare module "node:fs" {
    export function readFileSync(path: string, encoding: "utf8"): string;
}

declare module "node:module" {
    export function createRequire(url: string): {resolve(id: string): string};
}

declare module "node:path" {
    export function dirname(path: string): string;
    export function join(...parts: string[]): string;
}
