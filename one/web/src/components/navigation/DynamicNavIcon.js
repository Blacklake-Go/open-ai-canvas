'use client';

import React from 'react';
import {
  Flame,
  FolderOpen,
  Workflow,
  Bot,
  Zap,
  Sparkles,
  Compass,
  ExternalLink,
  Globe,
  Info,
} from 'lucide-react';

export default function DynamicNavIcon({ iconName, color, className = 'size-3.5' }) {
  const style = color ? { color } : undefined;
  switch (iconName) {
    case 'flame':
      return <Flame className={className} style={style} />;
    case 'folder':
      return <FolderOpen className={className} style={style} />;
    case 'workflow':
      return <Workflow className={className} style={style} />;
    case 'bot':
      return <Bot className={className} style={style} />;
    case 'zap':
      return <Zap className={className} style={style} />;
    case 'sparkles':
      return <Sparkles className={className} style={style} />;
    case 'compass':
      return <Compass className={className} style={style} />;
    case 'external':
      return <ExternalLink className={className} style={style} />;
    case 'globe':
      return <Globe className={className} style={style} />;
    case 'info':
      return <Info className={className} style={style} />;
    default:
      return null;
  }
}
