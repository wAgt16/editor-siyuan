/**
 * 桌面端的浮层形态。
 *
 * 默认形态是页签（思源的自定义页签），两种情况下改用浮层：设置里把桌面端形态
 * 选成了「浮层」，或者当前前端就是思源弹出的独立窗口（desktop-window）——
 * 那种窗口只有一篇文档的容器、没有页签栏，插件页签在那里落不下来。
 *
 * 挂进来的是同一个视图（view.ts），样式与操作条与页签完全一致，差别只在容器与关闭路径：
 *
 * - 操作条上不放关闭按钮，浮层本身也没有标题栏与右上角的 ×（文件名显示在操作条上）；
 * - 关闭只有两条路径：Esc 与点击浮层外的空白，两条都先过 close-guard 的 confirmClose，
 *   有未保存改动时先问保存；
 * - 思源的全局键盘处理会无条件销毁最上层对话框（boot/globalEvent/keydown.ts），
 *   所以 Esc 必须在捕获阶段拦下，否则有未保存改动时能绕过确认直接丢掉浮层。
 */
import {Dialog} from "siyuan";
import {confirmClose} from "./close-guard";
import {confirmDialogOpen} from "./dialog";
import {createView, tabFor, type IEditorTab} from "./view";
import type {Settings} from "./config";
import type {T} from "./i18n";

export interface IPopupDeps {
    t: T;
    settings: () => Settings;
}

/**
 * 打开一个居中浮层承载编辑器。
 *
 * 同一个文件已经开着时只聚焦，不再叠第二个浮层：两份缓冲会互相覆盖。
 */
export function openPopupEditor(
    deps: IPopupDeps,
    data: {link: string; sy?: boolean},
    title: string,
): void {
    const opened = tabFor(data.link);
    if (opened) {
        opened.focus();
        return;
    }

    let view: IEditorTab | undefined;
    // 不给 title：标题栏同时是拖动手柄，而文件名已经显示在操作条上了
    const dialog = new Dialog({
        width: "80%",
        height: "80%",
        disableClose: true,
        hideCloseIcon: true,
        content: `<div class="editor-siyuan-popup__mount"></div>`,
        destroyCallback: () => {
            window.removeEventListener("keydown", onKeydown, true);
            // 兜底：别的路径（思源的全局 Esc、退出登录之类）直接销毁浮层时也要把视图收干净
            view?.dispose();
            view = undefined;
        },
    });
    const container = dialog.element.querySelector<HTMLElement>(".b3-dialog__container")!;
    // 样式挂在私有类名上（见 index.scss）。Dialog 的 containerClassName 较新，SDK 类型里还没有，
    // 直接打类名就不必抬高 minAppVersion。
    container.classList.add("editor-siyuan-popup");
    // 没有标题栏，就靠 aria-label 给浮层一个名字
    container.setAttribute("aria-label", title);

    /** 关闭：先确认，再销毁。用户取消时什么都不做，浮层留着。 */
    const requestClose = (): void => {
        const target = view;
        if (!target) {
            return;
        }
        confirmClose(target, deps.t, deps.settings, () => {
            view = undefined;
            target.dispose();
            dialog.destroy();
        });
    };

    function onKeydown(event: KeyboardEvent): void {
        // 确认框开着时这一按归它处理，见 dialog.ts 的 confirmDialogOpen
        if (event.key !== "Escape" || event.isComposing || confirmDialogOpen()) {
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        requestClose();
    }

    window.addEventListener("keydown", onKeydown, true);
    // 点浮层外的空白：宿主在 disableClose 下不会关它，这里自己接上确认
    dialog.element.querySelector(".b3-dialog__scrim")?.addEventListener("click", () => requestClose());

    const mount = dialog.element.querySelector<HTMLElement>(".editor-siyuan-popup__mount")!;
    view = createView({element: mount, data, title}, deps.t, deps.settings);
}
