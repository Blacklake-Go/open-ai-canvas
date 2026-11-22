import { Navigate, useLocation, useParams as useRRParams } from 'react-router';
import CanvasToolsStudio from '@/components/canvasTools/CanvasToolsStudio';
import LabPageClient from '@/components/lab/LabPageClient';
import '@/components/canvasTools/canvas-tools.css';
import { useUserSession } from '@/lib/hooks/useUserSession';
import { useDocumentTitle } from '@/pages/helpers/pageHelpers';
import RootNotFound from '@/pages/boundaries/RootNotFound';

const TOOL_ROUTES: Record<string, { toolId: string; title: string }> = Object.freeze({
  outpaint: { toolId: 'outpaint', title: '扩图' },
  upscale: { toolId: 'upscale', title: '智能超清' },
  cutout: { toolId: 'cutout', title: '抠图' },
  'three-view': { toolId: 'preset', title: '三视图' },
  preset: { toolId: 'preset', title: '三视图' },
  'multi-angle': { toolId: 'view_control', title: '多角度' },
  'view-control': { toolId: 'view_control', title: '多角度' },
  view_control: { toolId: 'view_control', title: '多角度' },
});

const PRESET_ROUTES: Record<string, string> = Object.freeze({
  'scene-top-view': 'scene_top_view',
  storyboard: 'continuous_storyboard',
  'nine-grid': 'multi_camera_nine_grid',
  character: 'character_three_view',
  face: 'face_three_view',
  product: 'product_three_view',
  scene_top_view: 'scene_top_view',
  continuous_storyboard: 'continuous_storyboard',
  multi_camera_nine_grid: 'multi_camera_nine_grid',
  character_three_view: 'character_three_view',
  face_three_view: 'face_three_view',
  product_three_view: 'product_three_view',
});

const PRESET_LABELS: Record<string, string> = Object.freeze({
  scene_top_view: '场景俯视图',
  continuous_storyboard: '连续分镜图',
  multi_camera_nine_grid: '多机位九宫格',
  character_three_view: '人物三视图',
  face_three_view: '面部三视图',
  product_three_view: '产品三视图',
});

function resolveCanvasToolRoute(
  slug: string[],
  queryPreset?: string | null
): { toolId: string; title: string; presetId?: string } | null {
  const segments = slug.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean);
  if (!segments.length || segments.length > 2) return null;

  const tool = TOOL_ROUTES[segments[0]];
  if (!tool) return null;

  if (segments.length === 2) {
    if (tool.toolId !== 'preset') return null;
    const presetId = PRESET_ROUTES[segments[1]];
    return presetId ? { ...tool, presetId } : null;
  }

  if (tool.toolId === 'preset' && queryPreset) {
    const presetId = PRESET_ROUTES[String(queryPreset).trim().toLowerCase()];
    if (presetId) return { ...tool, presetId };
  }

  return tool;
}

export function ZhCanvasToolsPage() {
  useDocumentTitle('画布工具 — SupDance');
  const { user } = useUserSession();
  const initialUser = user
    ? { id: user.id, displayName: user.displayName, avatar: user.avatar || null }
    : null;

  return <CanvasToolsStudio initialUser={initialUser} />;
}

export function ZhCanvasToolDetailPage() {
  const rrParams = useRRParams();
  const location = useLocation();
  const { user } = useUserSession();
  const slug = typeof rrParams['*'] === 'string' ? rrParams['*'].split('/').filter(Boolean) : [];
  const queryPreset = new URLSearchParams(location.search).get('preset');
  const route = resolveCanvasToolRoute(slug, queryPreset);

  const label = route
    ? route.presetId
      ? `${route.title} · ${PRESET_LABELS[route.presetId]}`
      : route.title
    : null;
  useDocumentTitle(label ? `${label} — SupDance 画布` : '画布工具 — SupDance');

  if (!route) {
    return <RootNotFound />;
  }

  const initialUser = user
    ? { id: user.id, displayName: user.displayName, avatar: user.avatar || null }
    : null;

  return (
    <CanvasToolsStudio
      initialUser={initialUser}
      initialTool={route.toolId}
      initialPreset={route.presetId || null}
    />
  );
}

export function CanvasToolsRedirectPage() {
  const rrParams = useRRParams();
  const location = useLocation();
  const slug = typeof rrParams['*'] === 'string' ? rrParams['*'].split('/').filter(Boolean) : [];
  const suffix = slug.length
    ? `/${slug.map((item) => encodeURIComponent(String(item))).join('/')}`
    : '';
  const presetVal = new URLSearchParams(location.search).get('preset');
  const preset = presetVal ? `?preset=${encodeURIComponent(presetVal)}` : '';
  return <Navigate to={`/zh/canvas-tools${suffix}${preset}`} replace />;
}

export function ZhLabPage() {
  useDocumentTitle('短剧工作坊 — SupDance Lab');
  return <LabPageClient />;
}

export function LabRedirectPage() {
  return <Navigate to="/zh/lab" replace />;
}
