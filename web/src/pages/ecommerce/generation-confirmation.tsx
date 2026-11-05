import { creationSource as _creationSource, creationLabel as _creationLabel } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { Button, Modal } from "antd";
import { useRef, useState } from "react";
import type { EcommerceDraft, EcommercePlan } from "@/services/api/ecommerce";
import { assertCommerceClaimsGrounded, assertCommercePlanCurrent, excludeCommerceFacts } from "./planner";
import { CommerceFactReview } from "./fact-review";

export function GenerationConfirmation({
    plan,
    draft,
    busy,
    completed,
    label,
    onConfirm,
    onSupplement,
}: {
    plan: EcommercePlan;
    draft: EcommerceDraft;
    busy: boolean;
    completed: boolean;
    label?: string;
    onConfirm: (reviewed: EcommercePlan) => Promise<void>;
    onSupplement: (value: string) => void;
}) {
    _useCreationLocale();
    const [open, setOpen] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState("");
    const locked = useRef(false);
    const remaining = plan.images.filter((image) => !image.taskId).length;
    const submit = async (reviewed: EcommercePlan) => {
        if (locked.current) return;
        locked.current = true;
        setConfirming(true);
        setError("");
        try {
            assertCommercePlanCurrent(reviewed, draft);
            assertCommerceClaimsGrounded(reviewed, draft);
            await onConfirm(reviewed);
            setOpen(false);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : _creationSource("creation.dbd0897dd53a6d98"));
        } finally {
            locked.current = false;
            setConfirming(false);
        }
    };
    return (
        <>
            {error ? (
                <p className="ecommerce-confirmation-note" role="alert">
                    {_creationLabel(error)}
                </p>
            ) : null}
            {!completed && plan.uncertainFacts.length ? <p className="ecommerce-confirmation-note">{_creationText("creation.622e0ba51534339f", { value1: plan.uncertainFacts.length })}</p> : null}
            <Button
                type="primary"
                block
                loading={busy || confirming}
                disabled={busy || completed}
                onClick={() => {
                    setError("");
                    try {
                        assertCommercePlanCurrent(plan, draft);
                    } catch (cause) {
                        setError((cause as Error).message);
                        return;
                    }
                    if (plan.uncertainFacts.length) setOpen(true);
                    else void submit(plan);
                }}
            >
                {label ||
                    (completed ? _creationText("creation.ea1044031e628098") : remaining < plan.images.length ? _creationText("creation.b1f4e5832f275057", { value1: remaining }) : _creationText("creation.a37ae81f86b20a91", { value1: plan.images.length }))}
            </Button>
            <Modal
                title={_creationText("creation.219004c1c9e86529")}
                open={open}
                footer={null}
                onCancel={() => {
                    if (!confirming) setOpen(false);
                }}
                closable={!confirming}
                maskClosable={!confirming}
            >
                <p>{_creationText("creation.bcd5671f4d68545b")}</p>
                {error ? (
                    <p className="ecommerce-confirmation-note" role="alert">
                        {_creationLabel(error)}
                    </p>
                ) : null}
                <div inert={confirming}>
                    <CommerceFactReview
                        facts={plan.uncertainFacts}
                        onApply={(value) => {
                            onSupplement(value);
                            setOpen(false);
                        }}
                        onExclude={() => void submit(excludeCommerceFacts(plan))}
                        excludeLabel="排除未核实主张并开始生成"
                    />
                </div>
                {confirming ? <p role="status">{_creationText("creation.9ce9f7db2016c391")}</p> : null}
            </Modal>
        </>
    );
}
