import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { Download } from 'lucide-react';
import { Modal, ModalContent, ModalFooter } from 'studio/ui/Overlay';
import { Button } from 'studio/ui/Button';
import { canvasProjectParam } from '@/lib/canvas-project-route';
import { ApiClientError } from '@/services/api/http';
import { readCanvasProject } from '@/services/api/canvas-projects';
import { safePackageFileName } from '@/components/asset-library/asset-library-transfer';

const fields = ['title', 'description', 'loading', 'unavailable', 'loadError', 'retry', 'close', 'download', 'nodes', 'connections', 'version', 'updated'];
const translations = {
  en: ['Canvas record', 'Saved in the ONE asset library.', 'Loading canvas…', 'This canvas is unavailable for this account.', 'Could not load the canvas. Try again.', 'Retry', 'Close', 'Download project JSON', 'Nodes', 'Connections', 'Version', 'Updated'],
  'zh-CN': ['画布项目', '保存在 ONE 资产库中的项目记录。', '正在读取画布…', '当前账号无法访问此画布。', '画布读取失败，请重试。', '重试', '关闭', '下载项目 JSON', '节点', '连线', '版本', '更新于'],
  'zh-TW': ['畫布專案', '儲存在 ONE 資產庫的專案記錄。', '正在讀取畫布…', '目前帳號無法存取此畫布。', '無法讀取畫布，請重試。', '重試', '關閉', '下載專案 JSON', '節點', '連線', '版本', '更新時間'],
  'ja-JP': ['キャンバス', 'ONE の素材ライブラリに保存済みのプロジェクトです。', 'キャンバスを読み込み中…', 'このアカウントではキャンバスを利用できません。', '読み込めませんでした。もう一度お試しください。', '再試行', '閉じる', 'プロジェクト JSON をダウンロード', 'ノード', '接続', 'バージョン', '更新日時'],
  'ko-KR': ['캔버스 기록', 'ONE 에셋 라이브러리에 저장된 프로젝트입니다.', '캔버스를 불러오는 중…', '이 계정에서는 캔버스에 접근할 수 없습니다.', '캔버스를 불러올 수 없습니다. 다시 시도하세요.', '다시 시도', '닫기', '프로젝트 JSON 다운로드', '노드', '연결', '버전', '업데이트'],
  es: ['Registro del lienzo', 'Proyecto guardado en la biblioteca de ONE.', 'Cargando lienzo…', 'El lienzo no está disponible para esta cuenta.', 'No se pudo cargar el lienzo. Inténtalo de nuevo.', 'Reintentar', 'Cerrar', 'Descargar JSON del proyecto', 'Nodos', 'Conexiones', 'Versión', 'Actualizado'],
};

function downloadProject(project) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safePackageFileName(project.name, 'canvas').slice(0, 120)}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function CanvasProjectRecord({ owner, locale }) {
  const [params, setParams] = useSearchParams();
  const previousFocus = useRef(null);
  const projectId = params.get(canvasProjectParam);
  const values = translations[locale] || translations.en;
  const copy = Object.fromEntries(fields.map((field, index) => [field, values[index]]));
  const query = useQuery({
    queryKey: ['one-canvas-project', owner, projectId],
    queryFn: ({ signal }) => readCanvasProject(projectId, owner, signal),
    enabled: Boolean(owner && projectId),
    retry: false,
    gcTime: 0,
  });
  if (!owner || !projectId) return null;

  const project = query.isSuccess && query.data.ownerUserId === owner ? query.data : null;
  const unavailable = query.isError && query.error instanceof ApiClientError && [401, 403, 404, 409].includes(query.error.status);
  const close = () => setParams((current) => {
    const next = new URLSearchParams(current);
    next.delete(canvasProjectParam);
    return next;
  }, { replace: true });
  const updatedAt = project && new Date(project.updatedAt);
  const facts = project && [
    [copy.nodes, Array.isArray(project.snapshot?.nodes) ? project.snapshot.nodes.length : 0],
    [copy.connections, Array.isArray(project.snapshot?.connections) ? project.snapshot.connections.length : 0],
    [copy.version, project.version],
    ...(updatedAt && Number.isFinite(updatedAt.valueOf())
      ? [[copy.updated, new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(updatedAt)]] : []),
  ];

  return (
    <Modal open onOpenChange={(open) => { if (!open) close(); }}>
      <ModalContent title={project?.name || copy.title} description={copy.description} showClose={false}
        onOpenAutoFocus={() => { previousFocus.current = document.activeElement; }}
        onCloseAutoFocus={(event) => {
          if (previousFocus.current instanceof HTMLElement && previousFocus.current.isConnected) {
            event.preventDefault();
            previousFocus.current.focus();
          }
        }}>
        {query.isPending && <p role="status" className="text-body-sm text-ink-muted">{copy.loading}</p>}
        {(query.isError || (query.isSuccess && !project)) && (
          <p role="alert" className="text-body-sm text-ink-muted">{unavailable || query.isSuccess ? copy.unavailable : copy.loadError}</p>
        )}
        {project?.thumbnailAssetId && (
          <img key={project.thumbnailAssetId} src={`/api/assets/${encodeURIComponent(project.thumbnailAssetId)}/download?inline=1`}
            alt="" className="mb-4 max-h-56 w-full rounded-lg bg-raised object-contain"
            onError={(event) => { event.currentTarget.hidden = true; }} />
        )}
        {facts && (
          <dl className="grid grid-cols-2 gap-3">
            {facts.map(([name, value]) => (
              <div key={name} className="min-w-0 rounded-lg border border-line bg-surface p-3">
                <dt className="text-caption text-ink-muted">{name}</dt>
                <dd className="mt-1 break-words text-body-sm font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        <ModalFooter>
          <Button variant="secondary" size="lg" onClick={close}>{copy.close}</Button>
          {query.isError && !unavailable && <Button size="lg" loading={query.isFetching} onClick={() => void query.refetch()}>{copy.retry}</Button>}
          {project && <Button variant="primary" size="lg" onClick={() => downloadProject(project)}><Download data-icon="inline-start" />{copy.download}</Button>}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
