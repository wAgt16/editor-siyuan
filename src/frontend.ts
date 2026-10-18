/**
 * 当前前端类型。
 *
 * 宿主把「跑在哪种前端上」做成了编译期常量（app/src/util/functions.ts 的 getFrontend），
 * 插件只能问宿主要。不要自己按 UA 或窗口宽度判断：桌面端也可能把窗口缩得很窄，
 * 而手机浏览器（browser-mobile）与手机 App（mobile）是两种前端，能力并不完全一样。
 */
import {getFrontend} from "siyuan";

export type TFrontend = ReturnType<typeof getFrontend>;

export const frontend = (): TFrontend => getFrontend();

/**
 * 浏览器前端：Docker 部署与网页版。没有 Electron，也就没有本地文件系统、
 * 原生菜单与可拦截的窗口关闭动作。
 */
export const isBrowserFrontend = (): boolean => frontend().startsWith("browser");
