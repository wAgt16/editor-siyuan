/**
 * 操作条右上角的「更多」菜单。
 *
 * 和编辑器右键菜单一样用思源原生的 Menu（宿主负责圆角、阴影、悬停色、禁用态），
 * 菜单项不配图标——思源代码块自己的「更多」菜单（换行、连字、行号）也是纯文字，
 * 这里对齐它。
 *
 * 两项都会改动正文，所以预览（只读）模式下置灰；当前语言没有对应实现时同样置灰：
 * 格式化靠 prettier 的 parser，压缩只有 JSON、JavaScript 与 CSS。
 */
import {Menu, showMessage} from "siyuan";
import type {EditorView} from "@codemirror/view";
import {canFormat, canMinify, formatText, minifyText} from "./format";
import {debug} from "./debug";
import type {T} from "./i18n";

export interface IMoreMenuDeps {
    view: EditorView;
    /** 当前语法高亮语言（hljs 标识）。 */
    language: string;
    /** 资源链接，用来取扩展名。 */
    link: string;
    readOnly: boolean;
    t: T;
}

export function openMoreMenu(deps: IMoreMenuDeps, x: number, y: number): void {
    const {view, language, link, readOnly, t} = deps;

    const run = (kind: "format" | "minify"): void => {
        void (async () => {
            const doc = view.state.doc;
            const text = doc.toString();
            try {
                const next = kind === "format"
                    ? await formatText(language, link, text)
                    : await minifyText(language, link, text);
                if (view.state.doc !== doc) {
                    // 计算期间用户敲过字：放弃这次结果，不能覆盖掉刚输入的内容
                    debug(`${kind} discarded`, {link, reason: "document changed while running"});
                    return;
                }
                // 整篇替换：撤销栈里只有一步，用户可以一次撤销回去
                view.dispatch({changes: {from: 0, to: view.state.doc.length, insert: next}});
                debug(`${kind} done`, {link, language, from: text.length, to: next.length});
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                debug(`${kind} failed`, {link, language, message});
                showMessage(`${t(kind === "format" ? "formatFailed" : "minifyFailed")}: ${message}`, 6000, "error");
            }
        })();
    };

    const menu = new Menu();
    menu.addItem({
        id: "format",
        iconHTML: "",
        label: t("formatCode"),
        disabled: readOnly || !canFormat(language, link),
        click: () => run("format"),
    });
    menu.addItem({
        id: "minify",
        iconHTML: "",
        label: t("minifyCode"),
        disabled: readOnly || !canMinify(language, link),
        click: () => run("minify"),
    });
    menu.open({x, y, isLeft: true});
}
