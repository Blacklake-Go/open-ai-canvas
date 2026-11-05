import { creationOptions as _creationOptions } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { App, Button, Checkbox, Input, Modal, Segmented } from "antd";
import { BookOpen, RefreshCw, Search, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { addSkill, installSkillUpload, listAddedSkills, listSkills, type Skill } from "@/services/api/skills";
import { curationQuery, matchesCuration, useSkillCuration } from "@/components/skills/skill-curation-browser";
import { fallbackSkillCategories } from "@/pages/skills/skill-catalog";
import { getActiveUserScope } from "@/lib/user-scope";

type Props = { selected: string[]; onChange: (ids: string[]) => void; disabled?: boolean };

export function EcommerceSkillPicker({ selected, onChange, disabled }: Props) {
    const { message } = App.useApp();
    _useCreationLocale();
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<"mine" | "public">("mine");
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState("");
    const { curation, error: curationError, retry: retryCuration } = useSkillCuration(open);
    const [installed, setInstalled] = useState<Skill[]>([]);
    const [market, setMarket] = useState<Skill[]>([]);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [installing, setInstalling] = useState("");
    const [uploading, setUploading] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const uploadLock = useRef(false);
    const selection = useRef(selected);
    selection.current = selected;
    const ownerScope = useRef(getActiveUserScope());
    const mounted = useRef(false);
    const isCurrent = useCallback(() => mounted.current && getActiveUserScope() === ownerScope.current, []);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    const refresh = useCallback(async () => {
        if (!isCurrent()) return;
        const result = await listAddedSkills();
        if (!isCurrent()) return;
        setInstalled(result.skills.filter((skill) => skill.isAdded));
    }, [isCurrent]);
    useEffect(() => {
        if (!open) return;
        void refresh().catch((cause) => {
            if (isCurrent()) message.error(cause instanceof Error ? cause.message : _creationText("creation.81b7339ecb82c522"));
        });
    }, [open, refresh, isCurrent]);
    useEffect(() => {
        if (!open || tab !== "public") return;
        let active = true;
        setLoading(true);
        const timer = window.setTimeout(() => {
            if (!isCurrent()) return;
            void listSkills({ scope: "public", search: query.trim(), pageSize: 30, page: 1, ...(curation?.enabled ? curationQuery(curation, category) : category ? { tag: category } : {}) })
                .then((result) => {
                    if (!active || !isCurrent()) return;
                    setMarket(result.skills);
                    setOffset(result.nextOffset);
                    setHasMore(result.hasMore);
                })
                .catch((cause) => {
                    if (active && isCurrent()) message.error(cause instanceof Error ? cause.message : _creationText("creation.0a451ba8ef0503d4"));
                })
                .finally(() => {
                    if (active && isCurrent()) setLoading(false);
                });
        }, 250);
        return () => {
            active = false;
            window.clearTimeout(timer);
        };
    }, [open, tab, query, category, curation, isCurrent]);
    const filtered =
        tab === "mine"
            ? installed.filter((skill) => `${skill.skillName} ${skill.description}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && (curation?.enabled ? matchesCuration(skill, curation, category) : !category || skill.tag === category))
            : market;
    const categories = !curation
        ? []
        : curation.enabled
          ? (curation.roots || [])
                .filter((root) => root.enabled)
                .flatMap((root) => [{ id: `root:${root.id}`, name: root.name, child: false }, ...curation.categories.filter((item) => item.enabled && item.rootTag === root.id).map((item) => ({ id: item.id, name: item.name, child: true }))])
          : fallbackSkillCategories.map((item) => ({ id: item.value, name: item.label, child: false }));
    const toggle = (id: string) => {
        const current = selection.current;
        if (current.includes(id)) onChange(current.filter((value) => value !== id));
        else if (current.length < 8) onChange([...current, id]);
        else message.warning(_creationText("creation.17997feb6152571b"));
    };
    const install = async (skill: Skill) => {
        if (!isCurrent()) return;
        setInstalling(skill.skillId);
        try {
            await addSkill(skill.skillId);
            if (!isCurrent()) return;
            await refresh();
            if (!isCurrent()) return;
            toggle(skill.skillId);
            message.success(_creationText("creation.062509d6a6f93878", { value1: skill.skillName }));
        } catch (cause) {
            if (isCurrent()) message.error(cause instanceof Error ? cause.message : _creationText("creation.5af119dcf4133102"));
        } finally {
            if (isCurrent()) setInstalling("");
        }
    };
    const loadMore = async () => {
        if (!isCurrent()) return;
        setLoading(true);
        try {
            const result = await listSkills({ scope: "public", search: query.trim(), pageSize: 30, page: Math.floor(offset / 30) + 1, ...(curation?.enabled ? curationQuery(curation, category) : category ? { tag: category } : {}) });
            if (!isCurrent()) return;
            setMarket((current) => [...current, ...result.skills.filter((skill) => !current.some((item) => item.skillId === skill.skillId))]);
            setOffset(result.nextOffset);
            setHasMore(result.hasMore);
        } catch (cause) {
            if (isCurrent()) message.error(cause instanceof Error ? cause.message : _creationText("creation.c0fc326fadc1f322"));
        } finally {
            if (isCurrent()) setLoading(false);
        }
    };
    const upload = async (file: File) => {
        if (uploadLock.current || disabled || !isCurrent()) return;
        if (!/\.(md|markdown|zip)$/i.test(file.name)) {
            message.error(_creationText("creation.3afbdcf076eb10b4"));
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            message.error(_creationText("creation.364481e1c9a09b99"));
            return;
        }
        if (selection.current.length >= 8) {
            message.warning(_creationText("creation.e99cebd988ac1928"));
            return;
        }
        uploadLock.current = true;
        setUploading(true);
        try {
            const { skill } = await installSkillUpload({ file, sourceType: /\.zip$/i.test(file.name) ? "zip" : "markdown", tag: "others", isPrivate: true });
            // Only attach completion to the project/account that started this upload.
            if (!isCurrent()) return;
            const canSelect = selection.current.includes(skill.skillId) || selection.current.length < 8;
            if (!selection.current.includes(skill.skillId) && canSelect) onChange([...selection.current, skill.skillId]);
            setInstalled((current) => [skill, ...current.filter((item) => item.skillId !== skill.skillId)]);
            setTab("mine");
            setQuery("");
            setCategory("");
            message.success(canSelect ? _creationText("creation.067806d4d1c69503") : _creationText("creation.975822b551739b2b"));
        } catch (cause) {
            if (isCurrent()) message.error(cause instanceof Error ? cause.message : _creationText("creation.8c6f6357ed81c4dd"));
        } finally {
            uploadLock.current = false;
            if (isCurrent()) setUploading(false);
        }
    };
    return (
        <div className="ecommerce-field">
            <span>{_creationText("creation.335f433e0f3e030f")}</span>
            <Button block icon={<BookOpen size={15} />} disabled={disabled} onClick={() => setOpen(true)}>
                {selected.length ? _creationText("creation.2b4f4f19c077bd10", { value1: selected.length }) : _creationText("creation.4b274f4643051a57")}
            </Button>
            <input
                ref={fileInput}
                type="file"
                accept=".md,.markdown,.zip"
                hidden
                aria-label={_creationText("creation.b7245147574caf62")}
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void upload(file);
                }}
            />
            <Button block icon={<Upload size={15} />} disabled={disabled || selected.length >= 8} loading={uploading} onClick={() => fileInput.current?.click()}>
                {_creationText("creation.cc2d1eb6e9051590")}
            </Button>
            <small className="ecommerce-model-note">{_creationText("creation.60dff9a3f21ece71")}</small>
            {selected.length ? <small className="ecommerce-model-note">{_creationText("creation.b9a564c2c1240627")}</small> : null}
            <Modal title={_creationText("creation.24f92e8b35c127ff")} open={open} onCancel={() => setOpen(false)} footer={<Button onClick={() => setOpen(false)}>{_creationText("settings.channel_complete_btn")}</Button>} width={780} destroyOnHidden>
                <div className="ecommerce-skill-controls">
                    <Segmented
                        value={tab}
                        options={_creationOptions([
                            { label: `我的技能 (${installed.length})`, value: "mine" },
                            { label: "公开技能", value: "public" },
                        ])}
                        onChange={(value) => {
                            setTab(value as "mine" | "public");
                            setQuery("");
                        }}
                    />
                    <Button aria-label={_creationText("creation.ef6c99d110631b93")} icon={<RefreshCw size={14} />} onClick={() => void refresh()} />
                </div>
                <Input
                    prefix={<Search size={15} />}
                    aria-label={_creationText("creation.4ce2f89fe6fba475")}
                    placeholder={_creationText("creation.72342e2d0071e5ee")}
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        if (event.target.value) setCategory("");
                    }}
                />
                {curationError ? (
                    <Button type="link" onClick={retryCuration}>
                        {_creationText("creation.277019fae4cca3d4")}
                    </Button>
                ) : null}
                <div className="ecommerce-skill-browser">
                    <nav className="ecommerce-skill-categories" aria-label={_creationText("admin.skill_curation")}>
                        <strong>{_creationText("admin.skill_curation")}</strong>
                        <button type="button" aria-pressed={!category} onClick={() => setCategory("")}>
                            {_creationText("creation.e7b1605b49420055")}
                        </button>
                        {categories.map((item) => (
                            <button
                                type="button"
                                className={item.child ? "is-child" : undefined}
                                key={item.id}
                                aria-pressed={category === item.id}
                                onClick={() => {
                                    setCategory(item.id);
                                    setQuery("");
                                }}
                            >
                                {item.name}
                            </button>
                        ))}
                    </nav>
                    <div className="ecommerce-skill-list">
                        {tab === "mine"
                            ? selected
                                  .filter((id) => !installed.some((skill) => skill.skillId === id))
                                  .map((id) => (
                                      <div className="ecommerce-skill-row" key={id}>
                                          <div>
                                              <strong>{_creationText("creation.3f92359b419cffcb")}</strong>
                                              <small>{_creationText("creation.44dfd62087fe3e4d")}</small>
                                          </div>
                                          <Button size="small" onClick={() => toggle(id)}>
                                              {_creationText("creation.6135d4159e892541")}
                                          </Button>
                                      </div>
                                  ))
                            : null}
                        {filtered.map((skill) => (
                            <div className="ecommerce-skill-row" key={skill.skillId}>
                                <div>
                                    <strong>{skill.skillName}</strong>
                                    <small>{skill.description || _creationText("creation.71083097a94f44f7")}</small>
                                </div>
                                {installed.some((item) => item.skillId === skill.skillId) ? (
                                    <Checkbox checked={selected.includes(skill.skillId)} disabled={!selected.includes(skill.skillId) && selected.length >= 8} onChange={() => toggle(skill.skillId)}>
                                        {_creationText("creation.cdfd0b34e4918648")}
                                    </Checkbox>
                                ) : (
                                    <Button size="small" loading={installing === skill.skillId} disabled={selected.length >= 8} onClick={() => void install(skill)}>
                                        {_creationText("creation.d92dfc4e9b0b193f")}
                                    </Button>
                                )}
                            </div>
                        ))}
                        {!filtered.length && !loading ? <p className="ecommerce-skill-empty">{tab === "mine" ? _creationText("creation.a50965847c1d63d6") : _creationText("creation.1e3e493d0d9a226a")}</p> : null}
                    </div>
                </div>
                {tab === "public" && hasMore ? (
                    <Button block loading={loading} onClick={() => void loadMore()}>
                        {_creationText("common.load_more")}
                    </Button>
                ) : null}
                <p className="ecommerce-skill-count">{_creationText("creation.d98610e2350ba7fd", { value1: selected.length })}</p>
            </Modal>
        </div>
    );
}
