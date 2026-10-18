/**
 * 全局测试准备。
 *
 * jsdom 没有布局引擎，CodeMirror 与思源的若干 UI 代码会碰到缺失的几何接口；
 * 这里只补「存在但恒为零」的实现，让逻辑跑得下去，不试图模拟真实布局。
 */
import {afterEach, beforeEach, vi} from "vitest";
import {installConfig, uninstallHljs} from "./env";
import {resetSiyuanMock} from "./siyuan";

function zeroRect(): DOMRect {
    return {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        toJSON: () => ({}),
    } as DOMRect;
}

if (typeof Range.prototype.getClientRects !== "function") {
    (Range.prototype as any).getClientRects = () => [] as unknown as DOMRectList;
}
if (typeof Range.prototype.getBoundingClientRect !== "function") {
    (Range.prototype as any).getBoundingClientRect = () => zeroRect();
}
if (typeof Element.prototype.scrollIntoView !== "function") {
    (Element.prototype as any).scrollIntoView = () => undefined;
}
if (typeof window.scrollTo !== "function") {
    (window as any).scrollTo = () => undefined;
}
if (typeof document.elementFromPoint !== "function") {
    (document as any).elementFromPoint = () => null;
}
if (typeof document.execCommand !== "function") {
    (document as any).execCommand = () => false;
}
if (typeof window.matchMedia !== "function") {
    (window as any).matchMedia = (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
    });
}
if (typeof globalThis.ResizeObserver !== "function") {
    (globalThis as any).ResizeObserver = class {
        observe(): void {
        }

        unobserve(): void {
        }

        disconnect(): void {
        }
    };
}
if (typeof globalThis.PointerEvent !== "function") {
    (globalThis as any).PointerEvent = class PointerEvent extends MouseEvent {
    };
}
if (typeof (globalThis as any).CSS === "undefined") {
    (globalThis as any).CSS = {escape: (value: string) => value};
}

beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    installConfig();
    uninstallHljs();
    resetSiyuanMock();
});

afterEach(() => {
    vi.unstubAllGlobals();
});
