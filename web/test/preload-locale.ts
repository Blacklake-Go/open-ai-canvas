// 测试断言按简体中文源文案编写；网站首次访问默认使用英语。
// 这里在任何测试模块加载前把界面语言固定为 zh-CN；需要验证其他语言的测试自行调用 setLocale。
import { useLocaleStore } from "@/stores/use-locale-store";
import { beforeEach } from "bun:test";

useLocaleStore.setState({ locale: "zh-CN" });
beforeEach(() => useLocaleStore.getState().setLocale("zh-CN"));
