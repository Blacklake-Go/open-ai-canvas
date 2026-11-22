'use client';
import * as React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { cn } from 'cn';
export const Switch = React.forwardRef(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root ref={ref} className={cn('control-focus inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-line bg-wash data-[state=checked]:bg-brand disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-fast',className)} {...props}>
    <SwitchPrimitive.Thumb className="block size-4 rounded-full bg-ink shadow-elevation-1 translate-x-1 data-[state=checked]:translate-x-6 transition-transform duration-base ease-standard" />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';
