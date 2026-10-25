import {describe, expect, it} from "vitest";
import {makeT, type I18n} from "../../src/i18n";

const table: I18n = {
    plain: "纯文本",
    greet: "你好，{name}",
    twice: "{name} 与 {name}",
    number: "共 {count} 项",
    nested: "{outer}-{inner}",
};

describe("makeT", () => {
    it("取到字符串时原样返回", () => {
        expect(makeT(table)("plain")).toBe("纯文本");
    });

    it("缺键时回退为键名，便于发现漏配", () => {
        expect(makeT(table)("missing.key")).toBe("missing.key");
    });

    it("值不是字符串时同样回退为键名", () => {
        const t = makeT({number: 1, nil: null, object: {a: 1}, bool: true});
        expect(t("number")).toBe("number");
        expect(t("nil")).toBe("nil");
        expect(t("object")).toBe("object");
        expect(t("bool")).toBe("bool");
    });

    it("按名字插值", () => {
        expect(makeT(table)("greet", {name: "思源"})).toBe("你好，思源");
    });

    it("同一个占位符出现多次时全部替换", () => {
        expect(makeT(table)("twice", {name: "A"})).toBe("A 与 A");
    });

    it("数字参数转成字符串", () => {
        expect(makeT(table)("number", {count: 42})).toBe("共 42 项");
    });

    it("一次替换多个占位符", () => {
        expect(makeT(table)("nested", {outer: "外", inner: "内"})).toBe("外-内");
    });

    it("没有传入的参数保留原样", () => {
        expect(makeT(table)("nested", {outer: "外"})).toBe("外-{inner}");
    });

    it("没有参数时不改动文本", () => {
        expect(makeT(table)("greet")).toBe("你好，{name}");
    });

    it("空参数对象与不传参数等价", () => {
        expect(makeT(table)("greet", {})).toBe("你好，{name}");
    });

    it("每次调用都返回新的函数，但共享同一张表", () => {
        const source = {key: "value"};
        expect(makeT(source)("key")).toBe("value");
        source.key = "changed";
        expect(makeT(source)("key")).toBe("changed");
    });
});
