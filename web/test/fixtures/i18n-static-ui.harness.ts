import { expect, test } from "bun:test";
import { transformStaticUi } from "../../build/static-ui-i18n";

const file = "/project/web/src/pages/test.tsx";
test("static UI compilation translates explicit display sinks and preserves task data", () => {
    const input = `export function Page({name,run}) { const payload = { prompt: "用户原始提示词", value: "中文枚举", title: "用户标题" }; return <><button title="保存作品" onClick={() => run({prompt:"生成一张图片", mode:"中文枚举"})}>保存</button><span>{name}</span><Input placeholder="输入关键词" value="实际输入"/><pre>示例代码</pre><div data-i18n-preserve-source>原始作品</div><Select options={[{label:"快速模式",value:"快速"}]}/></> }`;
    const result = transformStaticUi(input, file);
    expect(result.messages.map((row) => row.source)).toEqual(["保存作品", "保存", "输入关键词", "快速模式"]);
    expect(result.code).toContain('prompt: "生成一张图片"');
    expect(result.code).toContain('value="实际输入"');
    expect(result.code).toContain('value: "快速"');
    expect(result.code).toContain("示例代码");
    expect(result.code).toContain("原始作品");
    expect(result.code).toContain('title: "用户标题"');
});

test("UI interpolation preserves expressions and message identity is scoped", () => {
    const source = "const Page = () => <span>{`共 ${count} 项`}</span>";
    const first = transformStaticUi(source, file);
    expect(first.messages[0].source).toBe("共 {value1} 项");
    expect(first.code).toContain("value1: count");
    expect(transformStaticUi(source, file.replace("test.tsx", "other.tsx")).messages[0].key).not.toBe(first.messages[0].key);
    expect(() => transformStaticUi(source, file, { knownKeys: new Set() })).toThrow("Missing eight-locale UI entry");
    expect(transformStaticUi(source, file, { knownKeys: new Set([first.messages[0].key]) }).changed).toBe(true);
});

test("collecting does not mutate input and preserved source attributes remain literal", () => {
    const source = '<div translate="no" title="用户标题">不要翻译</div>';
    expect(transformStaticUi(source, file).messages).toEqual([]);
    expect(transformStaticUi("<button>保存</button>", file, { collectOnly: true }).changed).toBe(false);
    expect(transformStaticUi(source, "/project/web/src/i18n/messages.ts").changed).toBe(false);
});

test("document content and event payload labels remain verbatim while notification copy is localized", () => {
    const source =
        'const Page=()=> <><RichDocument content="用户原始文档"/><Tooltip content="说明文案"/><Select options={[{label:"选项",onClick:()=>send({label:"用户标签",prompt:"用户提示词"})}]}/></>;notification.error({message:"保存失败",description:"请稍后重试"})';
    const result = transformStaticUi(source, file);
    expect(result.messages.map((row) => row.source)).toEqual(["说明文案", "选项", "保存失败", "请稍后重试"]);
    expect(result.code).toContain('content="用户原始文档"');
    expect(result.code).toContain('label: "用户标签"');
    expect(result.code).toContain('prompt: "用户提示词"');
});
