'use client';

import { useEffect, useMemo } from 'react';
import { Form, Input, Modal, Select, Tag } from 'antd';
import { useAssetLibraryCopy, fillCopy } from './asset-library-i18n';
import { getAssetCategoryOptions } from './asset-library-format';

const CHARACTER_FIELD_KEYS = [
  'role',
  'appearance',
  'physique',
  'clothing',
  'personality',
  'props',
  'consistencyPrompt',
  'voiceLanguage',
  'voiceAge',
  'voiceTimbre',
];

const SCENE_FIELD_KEYS = ['description', 'prompt'];

function initialValues(asset, defaultFolderId) {
  const definition = asset?.data?.definition || {};
  const values = {
    kind: asset?.kind === 'entity' ? 'entity' : 'text',
    category: asset?.category || 'other',
    folderId: asset?.folderId || defaultFolderId || '',
    title: asset?.title || '',
    coverUrl: asset?.coverUrl || '',
    tags: Array.isArray(asset?.tags) ? asset.tags : [],
    source: asset?.source || '',
    note: asset?.note || '',
    content: asset?.kind === 'text' ? asset.data?.content || '' : '',
    definition: {},
  };
  for (const key of [...CHARACTER_FIELD_KEYS, ...SCENE_FIELD_KEYS, 'aliases']) {
    values.definition[key] = key === 'aliases'
      ? (Array.isArray(definition.aliases) ? definition.aliases : [])
      : (typeof definition[key] === 'string' ? definition[key] : '');
  }
  values.version = typeof definition.version === 'string' ? definition.version : '';
  return values;
}

export default function AssetEditorModal({ open, asset, defaultFolderId, folders = [], saving, onCancel, onSave }) {
  const copy = useAssetLibraryCopy();
  const [form] = Form.useForm();
  const kind = Form.useWatch('kind', form) || 'text';
  const category = Form.useWatch('category', form) || 'other';
  const title = Form.useWatch('title', form) || '';
  const coverUrl = Form.useWatch('coverUrl', form) || '';
  const tags = Form.useWatch('tags', form) || [];
  const content = Form.useWatch('content', form) || '';

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(initialValues(asset, defaultFolderId));
  }, [asset, defaultFolderId, form, open]);

  const folderOptions = useMemo(
    () => [{ label: copy.uncategorized, value: '' }, ...folders.map((folder) => ({ label: folder.name, value: folder.id }))],
    [copy.uncategorized, folders],
  );
  const categoryOptions = useMemo(
    () => getAssetCategoryOptions(copy).filter((option) => option.value !== 'all'),
    [copy],
  );

  const submit = async () => {
    const values = await form.validateFields();
    const definition = {};
    const keys = kind === 'entity' && (values.category === 'environment' || values.category === 'prop')
      ? SCENE_FIELD_KEYS
      : CHARACTER_FIELD_KEYS;
    for (const key of keys) {
      const value = values.definition?.[key];
      if (typeof value === 'string' && value.trim()) definition[key] = value.trim();
    }
    const aliases = Array.isArray(values.definition?.aliases) ? values.definition.aliases.filter(Boolean) : [];
    if (kind === 'entity' && aliases.length) definition.aliases = aliases;
    if (kind === 'entity' && values.version?.trim()) definition.version = values.version.trim();

    const payload = {
      kind,
      category: values.category || 'other',
      folderId: values.folderId || null,
      title: values.title?.trim() || '',
      coverUrl: values.coverUrl?.trim() || null,
      tags: values.tags || [],
      source: values.source?.trim() || '',
      note: values.note?.trim() || '',
    };
    if (kind === 'text') payload.data = { content: values.content || '' };
    else payload.data = { definition };

    await onSave(payload);
  };

  const initial = Array.from(String(title || '').trim())[0] || copy.assetInitial;
  const isSceneLike = category === 'environment' || category === 'prop';

  return (
    <Modal
      rootClassName="asset-library-overlay-root"
      className="library-modal asset-editor-modal"
      title={asset ? copy.editAsset : copy.newAsset}
      open={open}
      width={800}
      onCancel={onCancel}
      onOk={() => { void submit(); }}
      okText={copy.save}
      cancelText={copy.cancel}
      confirmLoading={saving}
      cancelButtonProps={{ disabled: saving }}
      closable={!saving}
      mask={{ closable: !saving }}
    >
      <div className="asset-editor-layout">
        <Form form={form} layout="vertical" requiredMark={false} className="asset-editor-form">
          <div className="asset-editor-row">
            <Form.Item name="kind" label={copy.fieldKind}>
              <Select
                classNames={{ popup: { root: 'asset-library-overlay-root' } }}
                disabled={Boolean(asset)}
                options={[
                  { label: copy.kindLabels.text, value: 'text' },
                  { label: copy.kindLabels.entity, value: 'entity' },
                ]}
              />
            </Form.Item>
            <Form.Item name="category" label={copy.fieldCategory}>
              <Select classNames={{ popup: { root: 'asset-library-overlay-root' } }} options={categoryOptions} />
            </Form.Item>
          </div>
          <Form.Item name="title" label={copy.fieldTitle} rules={[{ required: true, message: copy.titleRequired }]}>
            <Input maxLength={255} placeholder={copy.titlePlaceholder} />
          </Form.Item>
          <div className="asset-editor-row">
            <Form.Item name="folderId" label={copy.fieldFolder}>
              <Select classNames={{ popup: { root: 'asset-library-overlay-root' } }} options={folderOptions} />
            </Form.Item>
            <Form.Item name="tags" label={copy.fieldTags}>
              <Select classNames={{ popup: { root: 'asset-library-overlay-root' } }} mode="tags" tokenSeparators={[',', '，']} placeholder={copy.tagsPlaceholder} />
            </Form.Item>
          </div>
          {kind === 'entity' ? (
            <>
              <Form.Item name="coverUrl" label={copy.fieldCoverUrl}>
                <Input allowClear placeholder={copy.coverUrlPlaceholder} />
              </Form.Item>
              <div className="asset-editor-row">
                <Form.Item name={['definition', 'aliases']} label={copy.fieldAliases}>
                  <Select classNames={{ popup: { root: 'asset-library-overlay-root' } }} mode="tags" tokenSeparators={[',', '，']} placeholder={copy.aliasesPlaceholder} />
                </Form.Item>
                <Form.Item name="version" label={copy.fieldVersion}>
                  <Input allowClear placeholder={copy.versionPlaceholder} />
                </Form.Item>
              </div>
              <div className="asset-editor-section">{copy.profileSection}</div>
              {isSceneLike ? (
                SCENE_FIELD_KEYS.map((key) => {
                  const label = copy.sceneFields[key];
                  return (
                    <Form.Item key={key} name={['definition', key]} label={label}>
                      <Input.TextArea rows={key === 'prompt' ? 3 : 4} placeholder={fillCopy(copy.fillPlaceholder, { label })} />
                    </Form.Item>
                  );
                })
              ) : (
                <div className="asset-editor-grid">
                  {CHARACTER_FIELD_KEYS.map((key) => (
                    <Form.Item key={key} name={['definition', key]} label={copy.characterFields[key]}>
                      <Input.TextArea rows={2} placeholder={copy.optionalPlaceholder} />
                    </Form.Item>
                  ))}
                </div>
              )}
            </>
          ) : (
            <Form.Item name="content" label={copy.fieldContent} rules={[{ required: true, message: copy.contentRequired }]}>
              <Input.TextArea rows={10} placeholder={copy.contentPlaceholder} />
            </Form.Item>
          )}
          <div className="asset-editor-row">
            <Form.Item name="source" label={copy.fieldSource}>
              <Input allowClear placeholder={copy.sourcePlaceholder} />
            </Form.Item>
            <Form.Item name="note" label={copy.fieldNote}>
              <Input allowClear placeholder={copy.optional} />
            </Form.Item>
          </div>
        </Form>
        <aside className="asset-editor-preview">
          <span className="asset-editor-preview-label">{copy.preview}</span>
          <div className="asset-editor-preview-card">
            {kind === 'entity' ? (
              <div className="asset-editor-preview-cover">
                {coverUrl ? (
                  <>
                    <img src={coverUrl} alt="" aria-hidden="true" className="asset-editor-preview-blur" />
                    <img src={coverUrl} alt="" className="asset-editor-preview-image" />
                  </>
                ) : (
                  <span className="asset-editor-preview-initial">{initial}</span>
                )}
              </div>
            ) : (
              <div className="asset-editor-preview-text">{content || copy.noTextContent}</div>
            )}
            <div className="asset-editor-preview-meta">
              <strong title={title}>{title || copy.untitledAsset}</strong>
              <div className="asset-editor-preview-tags">
                {tags.length ? tags.map((tag) => <Tag key={tag}>{tag}</Tag>) : <Tag>{copy.untagged}</Tag>}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </Modal>
  );
}
