'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Crop,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
  Check,
  X,
  Upload,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/admin/AdminUi';

const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1 方形', ratio: 1 },
  { id: '3:1', label: '3:1 标准横版', ratio: 3 },
  { id: '4:1', label: '4:1 宽幅条标', ratio: 4 },
  { id: 'free', label: '自由比例', ratio: null },
];

export default function LogoCropper({
  imageSrc,
  onCropComplete,
  onCancel,
  initialRatio = '3:1',
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [aspectId, setAspectId] = useState(initialRatio);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270

  // 裁剪框在 Canvas 中的坐标与尺寸 (基于 canvas 逻辑坐标)
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState(null); // 'move' | 'nw' | 'ne' | 'se' | 'sw'
  const dragStartRef = useRef({ x: 0, y: 0, box: null });

  // 原始图像加载对象与真实尺寸
  const [imageObj, setImageObj] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');

  // 1. 加载源图片
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      setImageObj(img);
      setZoom(1);
      setRotation(0);
    };
    img.onerror = () => {
      console.error('加载图片失败:', imageSrc);
    };
  }, [imageSrc]);

  // 2. 初始化裁剪框
  useEffect(() => {
    if (!imageObj || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const cw = canvas.width;
    const ch = canvas.height;

    const currentRatio = ASPECT_RATIOS.find((r) => r.id === aspectId)?.ratio;
    let w, h;

    if (currentRatio) {
      if (currentRatio >= 1) {
        w = Math.min(cw * 0.85, 360);
        h = w / currentRatio;
        if (h > ch * 0.85) {
          h = ch * 0.85;
          w = h * currentRatio;
        }
      } else {
        h = Math.min(ch * 0.85, 240);
        w = h * currentRatio;
      }
    } else {
      w = Math.min(cw * 0.7, 300);
      h = Math.min(ch * 0.7, 150);
    }

    setCropBox({
      x: Math.max(10, Math.round((cw - w) / 2)),
      y: Math.max(10, Math.round((ch - h) / 2)),
      width: Math.round(w),
      height: Math.round(h),
    });
  }, [imageObj, aspectId]);

  // 3. 绘制主 Canvas
  const drawMainCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj) return;
    const ctx = canvas.getContext('2d');
    const cw = canvas.width;
    const ch = canvas.height;

    ctx.clearRect(0, 0, cw, ch);

    // 绘制棋盘格背景表示透明度
    drawCheckboard(ctx, cw, ch);

    ctx.save();
    // 平移到中心并根据旋转与缩放绘制图像
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    // 计算适应尺寸
    const imgAspect = imageObj.width / imageObj.height;
    const canvasAspect = cw / ch;
    let dw, dh;
    if (imgAspect > canvasAspect) {
      dw = cw * 0.9;
      dh = dw / imgAspect;
    } else {
      dh = ch * 0.9;
      dw = dh * imgAspect;
    }

    ctx.drawImage(imageObj, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();

    // 绘制裁剪暗色半透明遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    // 上
    ctx.fillRect(0, 0, cw, cropBox.y);
    // 下
    ctx.fillRect(0, cropBox.y + cropBox.height, cw, ch - (cropBox.y + cropBox.height));
    // 左
    ctx.fillRect(0, cropBox.y, cropBox.x, cropBox.height);
    // 右
    ctx.fillRect(
      cropBox.x + cropBox.width,
      cropBox.y,
      cw - (cropBox.x + cropBox.width),
      cropBox.height
    );

    // 绘制裁剪框高亮边框与网格三等分线
    ctx.strokeStyle = '#e11d74';
    ctx.lineWidth = 2;
    ctx.strokeRect(cropBox.x, cropBox.y, cropBox.width, cropBox.height);

    // 辅助三等分参考线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // 纵线
    ctx.moveTo(cropBox.x + cropBox.width / 3, cropBox.y);
    ctx.lineTo(cropBox.x + cropBox.width / 3, cropBox.y + cropBox.height);
    ctx.moveTo(cropBox.x + (cropBox.width * 2) / 3, cropBox.y);
    ctx.lineTo(cropBox.x + (cropBox.width * 2) / 3, cropBox.y + cropBox.height);
    // 横线
    ctx.moveTo(cropBox.x, cropBox.y + cropBox.height / 3);
    ctx.lineTo(cropBox.x + cropBox.width, cropBox.y + cropBox.height / 3);
    ctx.moveTo(cropBox.x, cropBox.y + (cropBox.height * 2) / 3);
    ctx.lineTo(cropBox.x + cropBox.width, cropBox.y + (cropBox.height * 2) / 3);
    ctx.stroke();

    // 绘制四个控制角手柄
    const handleSize = 10;
    ctx.fillStyle = '#e11d74';
    // NW
    ctx.fillRect(cropBox.x - handleSize / 2, cropBox.y - handleSize / 2, handleSize, handleSize);
    // NE
    ctx.fillRect(
      cropBox.x + cropBox.width - handleSize / 2,
      cropBox.y - handleSize / 2,
      handleSize,
      handleSize
    );
    // SE
    ctx.fillRect(
      cropBox.x + cropBox.width - handleSize / 2,
      cropBox.y + cropBox.height - handleSize / 2,
      handleSize,
      handleSize
    );
    // SW
    ctx.fillRect(
      cropBox.x - handleSize / 2,
      cropBox.y + cropBox.height - handleSize / 2,
      handleSize,
      handleSize
    );
  }, [imageObj, zoom, rotation, cropBox]);

  // 4. 生成实时预览小图
  const updatePreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj || cropBox.width <= 0 || cropBox.height <= 0) return;

    // 创建离屏 Canvas 提取截取部分
    const offscreen = document.createElement('canvas');
    // 输出采用较高物理分辨率（2x 物理像素确保 Retina 屏高清）
    const targetHeight = 80;
    const targetWidth = Math.round((targetHeight * cropBox.width) / cropBox.height);
    offscreen.width = Math.max(32, targetWidth);
    offscreen.height = targetHeight;

    const oCtx = offscreen.getContext('2d');
    if (!oCtx) return;

    // 从主画布中取出裁剪区域
    // 注意：主画布上有遮罩，因此我们需要在离屏画布上独立绘制纯图像，再按比例截取
    const cw = canvas.width;
    const ch = canvas.height;

    // 临时画出无遮罩原图
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cw;
    tempCanvas.height = ch;
    const tCtx = tempCanvas.getContext('2d');
    if (!tCtx) return;

    tCtx.translate(cw / 2, ch / 2);
    tCtx.rotate((rotation * Math.PI) / 180);
    tCtx.scale(zoom, zoom);

    const imgAspect = imageObj.width / imageObj.height;
    const canvasAspect = cw / ch;
    let dw, dh;
    if (imgAspect > canvasAspect) {
      dw = cw * 0.9;
      dh = dw / imgAspect;
    } else {
      dh = ch * 0.9;
      dw = dh * imgAspect;
    }
    tCtx.drawImage(imageObj, -dw / 2, -dh / 2, dw, dh);

    // 把临时画布的 cropBox 区域拷贝到 offscreen
    oCtx.drawImage(
      tempCanvas,
      cropBox.x,
      cropBox.y,
      cropBox.width,
      cropBox.height,
      0,
      0,
      offscreen.width,
      offscreen.height
    );

    setPreviewUrl(offscreen.toDataURL('image/png'));
  }, [imageObj, zoom, rotation, cropBox]);

  useEffect(() => {
    drawMainCanvas();
    updatePreview();
  }, [drawMainCanvas, updatePreview]);

  // 鼠标交互控制：移动、缩放裁剪框
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e) => {
    const { x, y } = getCanvasCoords(e);
    const handleThreshold = 18;

    // 检查是否点击在 4 个角
    const isNW = Math.hypot(x - cropBox.x, y - cropBox.y) < handleThreshold;
    const isNE = Math.hypot(x - (cropBox.x + cropBox.width), y - cropBox.y) < handleThreshold;
    const isSE =
      Math.hypot(x - (cropBox.x + cropBox.width), y - (cropBox.y + cropBox.height)) <
      handleThreshold;
    const isSW = Math.hypot(x - cropBox.x, y - (cropBox.y + cropBox.height)) < handleThreshold;

    let handle = null;
    if (isNW) handle = 'nw';
    else if (isNE) handle = 'ne';
    else if (isSE) handle = 'se';
    else if (isSW) handle = 'sw';
    else if (
      x >= cropBox.x &&
      x <= cropBox.x + cropBox.width &&
      y >= cropBox.y &&
      y <= cropBox.y + cropBox.height
    ) {
      handle = 'move';
    }

    if (handle) {
      setIsDragging(true);
      setDragHandle(handle);
      dragStartRef.current = { x, y, box: { ...cropBox } };
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !dragHandle) return;
    const { x, y } = getCanvasCoords(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dx = x - dragStartRef.current.x;
    const dy = y - dragStartRef.current.y;
    const prev = dragStartRef.current.box;
    const currentRatio = ASPECT_RATIOS.find((r) => r.id === aspectId)?.ratio;

    if (dragHandle === 'move') {
      const newX = Math.max(0, Math.min(canvas.width - prev.width, prev.x + dx));
      const newY = Math.max(0, Math.min(canvas.height - prev.height, prev.y + dy));
      setCropBox((b) => ({ ...b, x: Math.round(newX), y: Math.round(newY) }));
    } else if (dragHandle === 'se') {
      let newW = Math.max(40, prev.width + dx);
      let newH = currentRatio ? newW / currentRatio : Math.max(30, prev.height + dy);
      if (prev.x + newW > canvas.width) {
        newW = canvas.width - prev.x;
        if (currentRatio) newH = newW / currentRatio;
      }
      if (prev.y + newH > canvas.height) {
        newH = canvas.height - prev.y;
        if (currentRatio) newW = newH * currentRatio;
      }
      setCropBox((b) => ({ ...b, width: Math.round(newW), height: Math.round(newH) }));
    } else if (dragHandle === 'sw') {
      let newW = Math.max(40, prev.width - dx);
      let newH = currentRatio ? newW / currentRatio : Math.max(30, prev.height + dy);
      let newX = prev.x + (prev.width - newW);
      if (newX < 0) {
        newX = 0;
        newW = prev.x + prev.width;
        if (currentRatio) newH = newW / currentRatio;
      }
      if (prev.y + newH > canvas.height) {
        newH = canvas.height - prev.y;
        if (currentRatio) {
          newW = newH * currentRatio;
          newX = prev.x + (prev.width - newW);
        }
      }
      setCropBox({
        x: Math.round(newX),
        y: prev.y,
        width: Math.round(newW),
        height: Math.round(newH),
      });
    } else if (dragHandle === 'ne') {
      let newW = Math.max(40, prev.width + dx);
      let newH = currentRatio ? newW / currentRatio : Math.max(30, prev.height - dy);
      let newY = prev.y + (prev.height - newH);
      if (prev.x + newW > canvas.width) {
        newW = canvas.width - prev.x;
        if (currentRatio) newH = newW / currentRatio;
      }
      if (newY < 0) {
        newY = 0;
        newH = prev.y + prev.height;
        if (currentRatio) newW = newH * currentRatio;
      }
      setCropBox({
        x: prev.x,
        y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH),
      });
    } else if (dragHandle === 'nw') {
      let newW = Math.max(40, prev.width - dx);
      let newH = currentRatio ? newW / currentRatio : Math.max(30, prev.height - dy);
      let newX = prev.x + (prev.width - newW);
      let newY = prev.y + (prev.height - newH);
      if (newX < 0) {
        newX = 0;
        newW = prev.x + prev.width;
        if (currentRatio) newH = newW / currentRatio;
      }
      if (newY < 0) {
        newY = 0;
        newH = prev.y + prev.height;
        if (currentRatio) {
          newW = newH * currentRatio;
          newX = prev.x + (prev.width - newW);
        }
      }
      setCropBox({
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH),
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragHandle(null);
  };

  // 滚轮缩放
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.max(0.4, Math.min(4, Number((z + delta).toFixed(2)))));
  };

  // 最终确认裁剪导出
  const handleConfirm = () => {
    if (!previewUrl) return;
    const canvas = canvasRef.current;
    if (!canvas || !imageObj) return;

    // 输出最终高清图片 Blob 与 DataURL
    const targetHeight = 96; // 3x 逻辑高度，极其清晰
    const targetWidth = Math.round((targetHeight * cropBox.width) / cropBox.height);
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = targetWidth;
    exportCanvas.height = targetHeight;
    const eCtx = exportCanvas.getContext('2d');
    if (!eCtx) return;

    // 在同等缩放下渲染
    const cw = canvas.width;
    const ch = canvas.height;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cw;
    tempCanvas.height = ch;
    const tCtx = tempCanvas.getContext('2d');
    if (!tCtx) return;

    tCtx.translate(cw / 2, ch / 2);
    tCtx.rotate((rotation * Math.PI) / 180);
    tCtx.scale(zoom, zoom);

    const imgAspect = imageObj.width / imageObj.height;
    const canvasAspect = cw / ch;
    let dw, dh;
    if (imgAspect > canvasAspect) {
      dw = cw * 0.9;
      dh = dw / imgAspect;
    } else {
      dh = ch * 0.9;
      dw = dh * imgAspect;
    }
    tCtx.drawImage(imageObj, -dw / 2, -dh / 2, dw, dh);

    // 拷贝裁剪区域
    eCtx.drawImage(
      tempCanvas,
      cropBox.x,
      cropBox.y,
      cropBox.width,
      cropBox.height,
      0,
      0,
      exportCanvas.width,
      exportCanvas.height
    );

    exportCanvas.toBlob((blob) => {
      const dataUrl = exportCanvas.toDataURL('image/png');
      if (onCropComplete) {
        onCropComplete({
          dataUrl,
          blob,
          width: exportCanvas.width,
          height: exportCanvas.height,
        });
      }
    }, 'image/png');
  };

  return (
    <div className="bg-slate-900 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
      {/* 顶部控制栏：比例切换与重置 */}
      <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-brand/10 border border-brand/20 text-brand">
            <Crop className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">图像裁剪工具</h4>
            <p className="text-xs text-slate-400">拖拽裁剪框选择最佳展示区域</p>
          </div>
        </div>

        {/* 常用比例快捷切换 */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
          {ASPECT_RATIOS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setAspectId(item.id)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                aspectId === item.id
                  ? 'bg-brand text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 主工作区：Canvas 画布 */}
      <div
        ref={containerRef}
        className="relative bg-slate-950 flex items-center justify-center p-4 select-none overflow-hidden"
        style={{ minHeight: '340px' }}
        onWheel={handleWheel}
      >
        <canvas
          ref={canvasRef}
          width={560}
          height={320}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="rounded-xl shadow-lg border border-slate-800/80 cursor-crosshair max-w-full"
        />

        {/* 浮动操作手柄提示 */}
        <div className="absolute top-6 left-6 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur border border-white/10 text-[11px] text-slate-300 pointer-events-none">
          滚轮可缩放 · 拖拽框选
        </div>
      </div>

      {/* 中部微调工具栏：缩放滑块与旋转 */}
      <div className="px-5 py-3 bg-slate-900/90 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[200px] max-w-xs">
          <ZoomOut className="w-4 h-4 text-slate-400" />
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand"
          />
          <ZoomIn className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400 font-mono w-10">
            {Math.round(zoom * 100)}%
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
            旋转 90°
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setRotation(0);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            重置
          </button>
        </div>
      </div>

      {/* 底部实时顶栏仿真对比与操作按钮 */}
      <div className="px-5 py-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* 双底色实时预览 */}
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="text-xs text-slate-400">实时效果:</div>
          {/* 暗色顶栏模拟 */}
          <div className="h-10 px-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-mono">暗底</span>
            {previewUrl ? (
              <img src={previewUrl} alt="Preview Dark" className="h-6 w-auto max-w-[120px] object-contain" />
            ) : (
              <div className="w-6 h-6 bg-slate-800 rounded animate-pulse" />
            )}
          </div>
          {/* 浅色顶栏模拟 */}
          <div className="h-10 px-3.5 rounded-xl bg-white border border-slate-300 flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-mono">亮底</span>
            {previewUrl ? (
              <img src={previewUrl} alt="Preview Light" className="h-6 w-auto max-w-[120px] object-contain" />
            ) : (
              <div className="w-6 h-6 bg-slate-200 rounded animate-pulse" />
            )}
          </div>
        </div>

        {/* 确认与取消 */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              取消
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand-hover rounded-xl shadow-lg shadow-brand/20 flex items-center gap-1.5 transition-all transform active:scale-95"
          >
            <Check className="w-4 h-4" />
            确认裁剪并应用
          </button>
        </div>
      </div>
    </div>
  );
}

// 辅助函数：绘制透明棋盘格底纹
function drawCheckboard(ctx, w, h, size = 12) {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1e293b';
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      if ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0) {
        ctx.fillRect(x, y, size, size);
      }
    }
  }
}
