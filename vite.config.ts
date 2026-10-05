import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {dirname, join} from "node:path";
import {defineConfig, type Plugin} from "vite";

/**
 * uglify-js 的浏览器入口。
 *
 * 它的 npm 包里没有浏览器构建：main 指向 tools/node.js（要 fs），而 tools/node.js 自己
 * 就是把 lib/*.js 按固定顺序读成文本、用一个 new Function 求值，最后补上 tools/exports.js。
 * 浏览器里没有 fs，所以这里在构建期做同一件事：按同样的顺序拼成一个自足模块，
 * 于是源码里 `import ... from "uglify-js/tools/exports.js"` 就能直接用。
 *
 * 顺序不能改，后一个文件依赖前面声明的函数；`exports` 必须传进去，
 * lib/mozilla-ast.js 会直接引用它（tools/node.js 也是这么做的）。
 */
const UGLIFY_FILES = [
    "lib/utils.js",
    "lib/ast.js",
    "lib/transform.js",
    "lib/parse.js",
    "lib/scope.js",
    "lib/compress.js",
    "lib/output.js",
    "lib/sourcemap.js",
    "lib/mozilla-ast.js",
    "lib/propmangle.js",
    "lib/minify.js",
    "tools/exports.js",
];

const UGLIFY_ENTRY = "uglify-js/tools/exports.js";
const UGLIFY_VIRTUAL = `\0${UGLIFY_ENTRY}`;

function uglifyBrowserEntry(): Plugin {
    return {
        name: "editor-siyuan:uglify-browser-entry",
        enforce: "pre",
        resolveId(source) {
            return source === UGLIFY_ENTRY ? UGLIFY_VIRTUAL : null;
        },
        load(id) {
            if (id !== UGLIFY_VIRTUAL) {
                return null;
            }
            const root = dirname(createRequire(import.meta.url).resolve("uglify-js/package.json"));
            const code = UGLIFY_FILES.map((file) => readFileSync(join(root, file), "utf8")).join("\n\n");
            return `const uglify = (function (exports) {\n${code}\nreturn exports;\n})({});\nexport const minify = uglify.minify;\n`;
        },
    };
}

// 思源插件入口固定为包内根目录的 index.js，CSS 固定为 index.css；
// siyuan 模块由宿主在运行时注入，必须保持 external。
//
// 产物必须是 CommonJS，不能是 ESM：宿主在 app/src/plugin/loader.ts 里把插件代码
// 包进 (function anonymous(require, module, exports){...}) 再 window.eval，
// require("siyuan") 由它注入。输出 ESM 会在第一行 import 处直接抛
// SyntaxError: Cannot use import statement outside a module。
export default defineConfig(({mode}) => ({
    plugins: [uglifyBrowserEntry()],
    build: {
        outDir: "dist",
        emptyOutDir: true,
        // 开发模式保留可读代码，生产模式由 esbuild 压缩
        minify: mode === "production",
        sourcemap: mode !== "production",
        lib: {
            entry: "src/index.ts",
            formats: ["cjs"],
            fileName: () => "index.js",
            cssFileName: "index",
        },
        rollupOptions: {
            external: ["siyuan"],
        },
    },
}));
