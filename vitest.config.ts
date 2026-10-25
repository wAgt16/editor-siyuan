import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {defineConfig, type Plugin} from "vite";

/**
 * 与 vite.config.ts 里同名的插件：uglify-js 的 npm 包没有浏览器入口，
 * 生产构建期把 lib/*.js 按固定顺序拼成一个自足模块。测试跑在 Node 里，
 * 但 format.ts 导入的就是这个虚拟入口，所以这里必须复刻同一段拼装，
 * 否则测试要么解析不到模块，要么拿到 tools/exports.js 里那些未定义的全局。
 *
 * 顺序不能改，后一个文件依赖前面声明的函数（见 vite.config.ts 的注释）。
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

export default defineConfig({
    plugins: [uglifyBrowserEntry()],
    resolve: {
        // siyuan 包只带类型声明，运行时代码由宿主注入。测试里换成一个最小实现，
        // 路径必须与 tests/support/siyuan.ts 是同一个文件，才能与相对导入共享实例。
        alias: {
            siyuan: fileURLToPath(new URL("./tests/support/siyuan.ts", import.meta.url)),
        },
    },
    test: {
        environment: "jsdom",
        setupFiles: ["./tests/support/setup.ts"],
        include: ["tests/**/*.test.ts"],
        clearMocks: true,
        restoreMocks: true,
        coverage: {
            provider: "v8",
            include: ["src/**/*.ts"],
            exclude: ["src/declarations.d.ts"],
            reporter: ["text", "html", "lcov"],
            reportsDirectory: "coverage",
            thresholds: {
                statements: 90,
                branches: 80,
                functions: 90,
                lines: 90,
            },
        },
    },
});
