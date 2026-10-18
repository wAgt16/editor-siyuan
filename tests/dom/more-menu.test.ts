import {beforeEach, describe, expect, it, vi} from "vitest";
import {Menu, showMessage} from "../support/siyuan";
import {makeT} from "../../src/i18n";
import {openMoreMenu} from "../../src/more-menu";
import {canFormat, canMinify, formatText, minifyText} from "../../src/format";

vi.mock("../../src/format", () => ({
    canFormat: vi.fn(),
    canMinify: vi.fn(),
    formatText: vi.fn(),
    minifyText: vi.fn(),
}));

const t = makeT({
    formatCode: "格式化",
    minifyCode: "压缩",
    formatFailed: "格式化失败",
    minifyFailed: "压缩失败",
});

interface IFakeView {
    view: any;
    text: () => string;
    replaceDoc: (next: any) => void;
}

function fakeView(text: string): IFakeView {
    let doc = {toString: () => text, length: text.length};
    const view: any = {
        state: {doc},
        dispatch: vi.fn(),
    };
    return {
        view,
        text: () => doc.toString(),
        replaceDoc: (next) => {
            doc = next;
            view.state.doc = next;
        },
    };
}

const lastMenu = (): Menu => Menu.instances[Menu.instances.length - 1];

beforeEach(() => {
    vi.mocked(canFormat).mockReturnValue(true);
    vi.mocked(canMinify).mockReturnValue(true);
    vi.mocked(formatText).mockResolvedValue("formatted");
    vi.mocked(minifyText).mockResolvedValue("minified");
});

describe("openMoreMenu", () => {
    it("渲染格式化和压缩两项，并按当前位置打开", () => {
        const {view} = fakeView("abc");
        openMoreMenu({view, language: "javascript", link: "assets/a.js", readOnly: false, t}, 10, 20);
        const menu = lastMenu();
        expect(menu.items.map((item) => item.id)).toEqual(["format", "minify"]);
        expect(menu.items.map((item) => item.label)).toEqual(["格式化", "压缩"]);
        expect(menu.openOptions).toEqual({x: 10, y: 20, isLeft: true});
    });

    it("只读时两项都置灰", () => {
        const {view} = fakeView("abc");
        openMoreMenu({view, language: "javascript", link: "assets/a.js", readOnly: true, t}, 0, 0);
        expect(lastMenu().items.every((item) => item.disabled)).toBe(true);
    });

    it("没有对应实现时置灰", () => {
        vi.mocked(canFormat).mockReturnValue(false);
        vi.mocked(canMinify).mockReturnValue(false);
        const {view} = fakeView("abc");
        openMoreMenu({view, language: "python", link: "assets/a.py", readOnly: false, t}, 0, 0);
        expect(lastMenu().items.every((item) => item.disabled)).toBe(true);
    });

    it("只有一种实现时只置灰另一项", () => {
        vi.mocked(canFormat).mockReturnValue(true);
        vi.mocked(canMinify).mockReturnValue(false);
        const {view} = fakeView("abc");
        openMoreMenu({view, language: "typescript", link: "assets/a.ts", readOnly: false, t}, 0, 0);
        expect(lastMenu().items[0].disabled).toBe(false);
        expect(lastMenu().items[1].disabled).toBe(true);
    });

    it("格式化成功后整篇替换，并保留一次撤销", async () => {
        const {view} = fakeView("const a=1");
        openMoreMenu({view, language: "javascript", link: "assets/a.js", readOnly: false, t}, 0, 0);
        lastMenu().items[0].click!();
        await vi.waitFor(() => expect(view.dispatch).toHaveBeenCalledTimes(1));
        expect(formatText).toHaveBeenCalledWith("javascript", "assets/a.js", "const a=1");
        expect(view.dispatch).toHaveBeenCalledWith({
            changes: {from: 0, to: "const a=1".length, insert: "formatted"},
        });
    });

    it("压缩成功后整篇替换", async () => {
        const {view} = fakeView("  a  ");
        openMoreMenu({view, language: "css", link: "assets/a.css", readOnly: false, t}, 0, 0);
        lastMenu().items[1].click!();
        await vi.waitFor(() => expect(view.dispatch).toHaveBeenCalledTimes(1));
        expect(minifyText).toHaveBeenCalledWith("css", "assets/a.css", "  a  ");
        expect(view.dispatch).toHaveBeenCalledWith({
            changes: {from: 0, to: 5, insert: "minified"},
        });
    });

    it("计算期间文档变了就放弃结果", async () => {
        const {view, replaceDoc} = fakeView("abc");
        vi.mocked(formatText).mockImplementation(async () => {
            replaceDoc({toString: () => "changed", length: 7});
            return "formatted";
        });
        openMoreMenu({view, language: "javascript", link: "assets/a.js", readOnly: false, t}, 0, 0);
        lastMenu().items[0].click!();
        await vi.waitFor(() => expect(formatText).toHaveBeenCalled());
        await Promise.resolve();
        expect(view.dispatch).not.toHaveBeenCalled();
    });

    it("格式化失败时展示带前缀的错误", async () => {
        vi.mocked(formatText).mockRejectedValue(new Error("boom"));
        const {view} = fakeView("abc");
        openMoreMenu({view, language: "javascript", link: "assets/a.js", readOnly: false, t}, 0, 0);
        lastMenu().items[0].click!();
        await vi.waitFor(() => expect(showMessage).toHaveBeenCalled());
        expect(showMessage).toHaveBeenCalledWith("格式化失败: boom", 6000, "error");
        expect(view.dispatch).not.toHaveBeenCalled();
    });

    it("压缩失败时展示带前缀的错误", async () => {
        vi.mocked(minifyText).mockRejectedValue(new Error("bad css"));
        const {view} = fakeView("abc");
        openMoreMenu({view, language: "css", link: "assets/a.css", readOnly: false, t}, 0, 0);
        lastMenu().items[1].click!();
        await vi.waitFor(() => expect(showMessage).toHaveBeenCalled());
        expect(showMessage).toHaveBeenCalledWith("压缩失败: bad css", 6000, "error");
    });

    it("抛出的不是 Error 时也转成字符串", async () => {
        vi.mocked(formatText).mockRejectedValue("plain string");
        const {view} = fakeView("abc");
        openMoreMenu({view, language: "javascript", link: "assets/a.js", readOnly: false, t}, 0, 0);
        lastMenu().items[0].click!();
        await vi.waitFor(() => expect(showMessage).toHaveBeenCalled());
        expect(showMessage).toHaveBeenCalledWith("格式化失败: plain string", 6000, "error");
    });
});
