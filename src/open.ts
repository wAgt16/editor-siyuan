/**
 * 打开入口。
 *
 * 两条路径，都用思源自己的扩展点：
 *
 * 1. 点击接管：`assets/` 链接的点击会发出可取消的 `open-asset` 事件，
 *    在监听器里 `preventDefault()` 就能顶掉默认的 shell.openPath。
 *    只接管设置里指定的那一个手势，其余手势原样交给思源——
 *    于是 Alt/Shift+单击仍然「使用默认程序打开」，Ctrl+单击仍然「打开文件位置」。
 *
 * 2. 右键菜单：`open-menu-link` 事件里往 detail.menu 加一项，
 *    宿主会把这些项统一包进 id 为 plugin 的「插件」子菜单，
 *    也就是需求里的「菜单 > 插件 > 使用 Editor 打开」。
 *
 * 3. 笔记文档的右键菜单：文件树上的 `open-menu-doctree` 同样由宿主包成
 *    「插件」子菜单，用来只读预览该文档的 .sy 源文件（见 registerSyPreview）。
 */
import {
    openTab,
    type App,
    type Custom,
    type IMenu,
    type IMenuBaseDetail,
    type Plugin,
} from "siyuan";
import {allowedExtensions, hasAllowedExtension, type Settings, type TTakeover} from "./config";
import {baseName, config, stripQuery} from "./util";
import {ICON_TAB} from "./icons";
import type {T} from "./i18n";

/**
 * 页签类型。
 * openTab 的 custom.id 必须等于「插件名 + 本值」：宿主按这个键找模型工厂，
 * 对不上时页签重启后会被当作「没有对应插件」清掉。
 */
export const TAB_TYPE = "textEditor";

export interface IOpenDeps {
    app: App;
    plugin: Plugin;
    t: T;
    settings: () => Settings;
}

const isMac = (): boolean => config().system?.os === "darwin";

/**
 * 与思源 editor/assetOpen.ts 的 resolveAssetOpenGesture 同义。
 * ctrl 那一档要按平台折算：mac 上是 ⌘，其他平台是 Control。
 */
function gestureOf(event?: MouseEvent): TTakeover {
    if (!event) {
        return "click";
    }
    const ctrl = isMac() ? (event.metaKey && !event.ctrlKey) : (!event.metaKey && event.ctrlKey);
    const count = Number(!!event.altKey) + Number(!!event.shiftKey) + Number(ctrl);
    if (count !== 1) {
        return "click";
    }
    if (event.altKey) {
        return "altClick";
    }
    if (event.shiftKey) {
        return "shiftClick";
    }
    return "ctrlClick";
}

/** 准入判断：必须是 assets 资源，且扩展名在白名单里。 */
function candidate(link: string | null | undefined, settings: Settings): string | undefined {
    if (!link || !link.startsWith("assets/")) {
        return undefined;
    }
    // 去掉 ?box= 之类的查询串后才能当页签键、语言记忆键与暂存键
    return hasAllowedExtension(link, allowedExtensions(settings)) ? stripQuery(link) : undefined;
}

/** 同一个资源已经开着就聚焦它，不再开第二个页签：两份缓冲会互相覆盖。 */
function focusExistingTab(plugin: Plugin, link: string): boolean {
    for (const models of Object.values(plugin.getOpenedTab())) {
        for (const model of models as Custom[]) {
            if (model.data?.link === link) {
                model.tab?.parent?.switchTab(model.tab.headElement, true);
                return true;
            }
        }
    }
    return false;
}

export function openEditor(deps: IOpenDeps, link: string): void {
    if (focusExistingTab(deps.plugin, link)) {
        return;
    }
    void openTab({
        app: deps.app,
        custom: {
            id: deps.plugin.name + TAB_TYPE,
            icon: ICON_TAB,
            // 页签标题只放文件名：资源链接恒为 assets/<文件名>，带上目录不会增加区分度
            title: link.slice("assets/".length),
            data: {link},
        },
    });
}

/** 笔记文档的 .sy 源文件预览：与资源页签同一个页签类型，但只读到底。 */
export function openSyPreview(deps: IOpenDeps, notebookId: string, path: string): void {
    // 落盘位置是 /data/<笔记本ID>/<文档路径>，文档路径形如 /2021….sy
    const apiPath = `/data/${notebookId}${path}`;
    if (focusExistingTab(deps.plugin, apiPath)) {
        return;
    }
    void openTab({
        app: deps.app,
        custom: {
            id: deps.plugin.name + TAB_TYPE,
            icon: ICON_TAB,
            // 页签标题取文档名（.sy 文件名就是思源里的文档名），去掉扩展名
            title: baseName(path).replace(/\.sy$/i, ""),
            data: {link: apiPath, sy: true},
        },
    });
}

/**
 * 文件树里笔记文档的右键菜单。
 *
 * 文档路径在 detail.items 里，已经带了 .sy 扩展名。注意文件夹也会走同一个事件，
 * 而且 initFileMenu 把 detail.type 写死成 "doc"，所以只能靠 .sy 后缀判断。
 */
function registerSyPreview(deps: IOpenDeps): void {
    deps.plugin.eventBus.on("open-menu-doctree", (event) => {
        if (!deps.settings().previewSy || event.detail.type !== "doc") {
            return;
        }
        const item = event.detail.items?.[0];
        if (!item || !item.path.toLowerCase().endsWith(".sy")) {
            return;
        }
        const menuItem: IMenu = {
            id: "editorSiyuanPreviewSy",
            label: deps.t("previewSyMenu"),
            icon: ICON_TAB,
            click: () => openSyPreview(deps, item.notebookId, item.path),
        };
        event.detail.menu.addItem(menuItem);
    });
}

export function registerOpenHandlers(deps: IOpenDeps): void {
    deps.plugin.eventBus.on("open-asset", (event) => {
        const settings = deps.settings();
        if (settings.takeover === "none") {
            return;
        }
        const link = candidate(event.detail.path, settings);
        if (!link || gestureOf(event.detail.event) !== settings.takeover) {
            return;
        }
        // 同步拦下，默认的 shell.openPath 就不会执行
        event.preventDefault();
        openEditor(deps, link);
    });

    deps.plugin.eventBus.on("open-menu-link", (event: CustomEvent<IMenuBaseDetail>) => {
        const link = candidate(event.detail.element?.getAttribute("data-href"), deps.settings());
        if (!link) {
            return;
        }
        const item: IMenu = {
            id: "editorSiyuanOpen",
            label: deps.t("openWithEditor"),
            icon: ICON_TAB,
            click: () => openEditor(deps, link),
        };
        event.detail.menu.addItem(item);
    });

    registerSyPreview(deps);
}
