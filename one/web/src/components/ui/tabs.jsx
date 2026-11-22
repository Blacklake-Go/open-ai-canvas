import * as React from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

function withoutRadiusUtilities(className = '') {
  return String(className)
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !/^!?rounded(?:-|$)/.test(token.slice(token.lastIndexOf(':') + 1)))
    .join(' ');
}

function Tabs({ className, ...props }) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn('flex flex-col gap-2', className)} {...props} />;
}

function TabsList({ className, ...props }) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-pill-segmented
      className={cn(
        'inline-flex h-segment-track-md w-fit items-center justify-center gap-1 rounded-full border border-line-subtle bg-well p-1 text-ink-muted',
        withoutRadiusUtilities(className)
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      data-pill-segment-item
      className={cn(
        'inline-flex h-segment-item-md items-center justify-center gap-2 rounded-full px-3 text-body-sm font-semibold text-ink-muted control-focus select-none transition-[background-color,color,box-shadow] duration-fast ease-standard pointer-events-auto',
        'hover:text-ink hover:bg-wash',
        'data-[state=active]:bg-surface-inverse data-[state=active]:text-ink-inverse data-[state=active]:shadow-elevation-1',
        'disabled:pointer-events-none disabled:opacity-45',
        withoutRadiusUtilities(className)
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn('mt-2 outline-none', className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
