import { useRef, useState } from "react";
import { App, Button, Checkbox, ConfigProvider, Input, Radio, Select, Segmented, Slider, Space, Switch, Table, Tabs, Tooltip } from "antd";
import { AppModal } from "@/components/ui/product/app-modal";
import { AppDrawer } from "@/components/ui/product/app-drawer";
import { createVisualEngineAntTheme } from "../../adapters/antd-theme";
import { createVisualEngineOverlayStyles } from "../../adapters/overlay-theme";
import type { VisualEngineConfig } from "../../types";

function GalleryControls({ config, mode }: { config: VisualEngineConfig; mode: "light" | "dark" }) {
    const { message } = App.useApp();
    const [selected, setSelected] = useState("image");
    const [modal, setModal] = useState(false);
    const [drawer, setDrawer] = useState(false);
    const modalTrigger = useRef<HTMLButtonElement>(null);
    const drawerTrigger = useRef<HTMLButtonElement>(null);
    return (
        <div className="space-y-5 text-sm" data-canvas-no-zoom data-canvas-wheel-scroll>
            <p className="text-xs text-[var(--muted-foreground)]">真实组件状态示例，不提交业务任务。</p>
            <Space wrap>
                <Button type="primary">主操作按钮</Button>
                <Button>次级按钮</Button>
                <Button danger>危险操作</Button>
                <Button disabled>禁用</Button>
                <Button loading>加载中</Button>
            </Space>
            <Input aria-label="组件预览输入框" placeholder="按 Tab 检查焦点环" />
            <Input.TextArea aria-label="组件预览多行输入框" placeholder="长文本与多行输入" autoSize={{ minRows: 2, maxRows: 4 }} />
            <Input status="error" aria-label="错误状态输入框" placeholder="错误状态示例" />
            <Select
                aria-label="组件预览选择器"
                value={selected}
                onChange={setSelected}
                className="w-full"
                options={[
                    { value: "image", label: "图片创作" },
                    { value: "video", label: "视频创作" },
                    { value: "audio", label: "音频创作" },
                ]}
            />
            <Space wrap>
                <Checkbox>普通选择</Checkbox>
                <Radio.Group aria-label="预览单选" defaultValue="first">
                    <Radio value="first">第一项</Radio>
                    <Radio value="second">第二项</Radio>
                </Radio.Group>
                <Switch aria-label="预览持久开关" defaultChecked />
            </Space>
            <Slider aria-label="预览滑杆" defaultValue={40} />
            <Segmented options={["画布", "列表"]} defaultValue="画布" />
            <Tabs
                items={[
                    {
                        key: "first",
                        label: "状态一",
                        children: (
                            <div className="rounded-lg border border-[var(--border)] p-4" data-visual-component="card" data-visual-depth="E1">
                                卡片 / 工具条 / 选择状态
                            </div>
                        ),
                    },
                    { key: "second", label: "状态二", children: "第二个面板" },
                ]}
            />
            <Table
                size="small"
                pagination={false}
                rowKey="id"
                dataSource={[{ id: "sample", name: "预览项目", status: "等待操作" }]}
                columns={[
                    { title: "项目", dataIndex: "name" },
                    { title: "状态", dataIndex: "status" },
                ]}
            />
            <Space wrap>
                <Tooltip title="提示内容与浮层定位">
                    <Button ref={modalTrigger} onClick={() => setModal(true)}>
                        打开模态预览
                    </Button>
                </Tooltip>
                <Button ref={drawerTrigger} onClick={() => setDrawer(true)}>
                    打开抽屉预览
                </Button>
                <Button onClick={() => message.info("组件提示示例")}>显示 Toast</Button>
            </Space>
            <AppModal styles={createVisualEngineOverlayStyles(config, mode, "modal")} title="模态与下拉焦点测试" open={modal} onCancel={() => setModal(false)} afterClose={() => modalTrigger.current?.focus()} footer={null}>
                <div className="space-y-4">
                    <Input aria-label="模态预览输入框" />
                    <Select
                        aria-label="模态内选择器"
                        className="w-full"
                        defaultValue="first"
                        options={[
                            { value: "first", label: "第一项" },
                            { value: "second", label: "第二项" },
                        ]}
                    />
                    <Button onClick={() => setModal(false)}>关闭模态预览</Button>
                </div>
            </AppModal>
            <AppDrawer
                styles={createVisualEngineOverlayStyles(config, mode, "drawer")}
                title="滚动抽屉测试"
                open={drawer}
                onClose={() => setDrawer(false)}
                afterOpenChange={(open) => {
                    if (!open) drawerTrigger.current?.focus();
                }}
            >
                <div className="space-y-5">
                    {Array.from({ length: 20 }, (_, index) => (
                        <p key={index}>可滚动内容 {index + 1}</p>
                    ))}
                </div>
            </AppDrawer>
        </div>
    );
}
export function ComponentGallery({ config, mode }: { config: VisualEngineConfig; mode: "light" | "dark" }) {
    return (
        <ConfigProvider theme={createVisualEngineAntTheme(config, mode)}>
            <App>
                <GalleryControls config={config} mode={mode} />
            </App>
        </ConfigProvider>
    );
}
