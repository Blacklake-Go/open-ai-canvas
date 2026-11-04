import { Button, Form, Input, Select } from "antd";

import { AppModal } from "@/components/ui/product/app-modal";
import type { CreationInspiration } from "@/lib/inspirations/catalog";
import { useI18n } from "@/supdance/plugins/i18n";
import { normalizeDraft, type InspirationDraft } from "@/stores/use-inspiration-store";

export type InspirationCategoryChoice = { label: string; value: string };

/** 编辑器只收集用户能填的字段；id、来源、署名由本地库自己管。 */
type FormValues = {
    title: string;
    description?: string;
    image: string;
    mode: CreationInspiration["mode"];
    category?: string;
    tags?: string;
    ratio?: string;
    prompt: string;
    promptZh?: string;
};

function toFormValues(item: CreationInspiration | null): FormValues {
    return {
        title: item?.title ?? "",
        description: item?.description ?? "",
        image: item?.image ?? "",
        mode: item?.mode ?? "image",
        category: item?.category ?? "",
        tags: item?.tags?.join("，") ?? "",
        ratio: item?.ratio ?? "",
        prompt: item?.prompt ?? "",
        promptZh: item?.promptZh ?? "",
    };
}

export function InspirationEditorModal({
    open,
    item,
    categoryOptions,
    onClose,
    onSubmit,
}: {
    open: boolean;
    item: CreationInspiration | null;
    categoryOptions: InspirationCategoryChoice[];
    onClose: () => void;
    onSubmit: (draft: InspirationDraft) => void;
}) {
    const { t } = useI18n();
    const [form] = Form.useForm<FormValues>();

    const handleOk = async () => {
        const values = await form.validateFields().catch(() => null);
        if (!values) return;
        const tags = (values.tags ?? "")
            .split(/[，,]/)
            .map((tag) => tag.trim())
            .filter(Boolean);
        // 走 store 里同一套收敛规则，表单不做第二套校验。
        const draft = normalizeDraft({
            title: values.title,
            description: values.description ?? "",
            image: values.image,
            mode: values.mode,
            prompt: values.prompt,
            promptZh: values.promptZh,
            category: values.category,
            ratio: values.ratio,
            ...(tags.length ? { tags } : {}),
        });
        onSubmit(draft);
        form.resetFields();
        onClose();
    };

    return (
        <AppModal
            open={open}
            title={item ? t("inspiration.edit", undefined, "编辑灵感") : t("inspiration.new_inspiration", undefined, "新建灵感")}
            width={720}
            onCancel={() => {
                form.resetFields();
                onClose();
            }}
            afterOpenChange={(visible) => {
                if (visible) form.setFieldsValue(toFormValues(item));
            }}
            footer={
                <div className="flex justify-end gap-2">
                    <Button
                        onClick={() => {
                            form.resetFields();
                            onClose();
                        }}
                    >
                        {t("common.cancel", undefined, "取消")}
                    </Button>
                    <Button type="primary" onClick={() => void handleOk()}>
                        {item ? t("common.save", undefined, "保存") : t("common.create", undefined, "创建")}
                    </Button>
                </div>
            }
        >
            <Form form={form} layout="vertical" initialValues={toFormValues(item)} preserve={false}>
                {/* 字段较多，不限高的话底部按钮会被顶出视口，提交就点不到了。 */}
                <div className="max-h-[64vh] overflow-y-auto pr-1">
                    <Form.Item name="title" label={t("common.title", undefined, "标题")} rules={[{ required: true, message: t("inspiration.editor_title_required", undefined, "请填写标题") }]}>
                        <Input placeholder={t("inspiration.editor_title_placeholder", undefined, "例如：护肤品质感广告主视觉")} maxLength={80} />
                    </Form.Item>
                    <Form.Item name="description" label={t("inspiration.editor_description", undefined, "一句话描述")}>
                        <Input placeholder={t("inspiration.editor_description_hint", undefined, "卡片上铺两行，说明这个提示词适合做什么")} maxLength={120} />
                    </Form.Item>
                    <Form.Item name="image" label={t("inspiration.editor_cover_url", undefined, "封面地址")} rules={[{ required: true, message: t("inspiration.editor_cover_required", undefined, "请填写封面图片地址") }]}>
                        <Input placeholder={t("inspiration.editor_cover_placeholder", undefined, "https:// 开头的图片地址，或 /public 下的本地路径")} />
                    </Form.Item>
                    <div className="grid gap-x-4 sm:grid-cols-3">
                        <Form.Item name="mode" label={t("inspiration.editor_mode", undefined, "创作类型")} rules={[{ required: true }]}>
                            <Select
                                options={[
                                    { label: t("common.image", undefined, "图片"), value: "image" },
                                    { label: t("common.video", undefined, "视频"), value: "video" },
                                    { label: t("common.text", undefined, "文本"), value: "text" },
                                ]}
                            />
                        </Form.Item>
                        <Form.Item name="category" label={t("common.category", undefined, "分类")}>
                            <Select allowClear showSearch placeholder={t("inspiration.editor_category_placeholder", undefined, "选一个或留空")} options={categoryOptions} />
                        </Form.Item>
                        <Form.Item name="ratio" label={t("common.aspect_ratio", undefined, "画面比例")}>
                            <Input placeholder={t("inspiration.editor_aspect_placeholder", undefined, "例如 16:9")} maxLength={12} />
                        </Form.Item>
                    </div>
                    <Form.Item name="tags" label={t("plugins.tags", undefined, "标签")} extra={t("inspiration.editor_tags_hint", undefined, "用逗号分隔，最多六个")}>
                        <Input placeholder={t("inspiration.editor_tags_placeholder", undefined, "电商产品，海报排版")} maxLength={120} />
                    </Form.Item>
                    <Form.Item name="prompt" label={t("inspiration.editor_prompt_body", undefined, "提示词正文")} rules={[{ required: true, message: t("inspiration.editor_prompt_required", undefined, "请填写提示词正文") }]}>
                        <Input.TextArea rows={6} placeholder={t("inspiration.editor_prompt_hint", undefined, "粘贴完整提示词；外部英文提示词也可以直接放这里")} />
                    </Form.Item>
                    <Form.Item name="promptZh" label={t("inspiration.editor_prompt_zh", undefined, "中文正文（可选）")} extra={t("inspiration.editor_prompt_zh_hint", undefined, "填了以后，卡片和「用这个创意创作」会优先用中文这版")}>
                        <Input.TextArea rows={4} placeholder={t("inspiration.editor_prompt_zh_placeholder", undefined, "中文改写版，留空则只用上面的正文")} />
                    </Form.Item>
                </div>
            </Form>
        </AppModal>
    );
}
