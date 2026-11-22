import React, { Suspense, lazy } from 'react';

export interface DynamicOptions {
  loading?: () => React.ReactNode;
  ssr?: boolean;
}

type Loader<P> = () => Promise<
  React.ComponentType<P> | { default: React.ComponentType<P> }
>;

export default function dynamic<P extends object = Record<string, unknown>>(
  loader: Loader<P>,
  options: DynamicOptions = {},
): React.ComponentType<P> & { preload?: () => Promise<unknown> } {
  const LazyComponent = lazy(async () => {
    const mod = await loader();
    if (mod && typeof mod === 'object' && 'default' in mod && mod.default) {
      return { default: mod.default };
    }
    return { default: mod as React.ComponentType<P> };
  });

  const Loading = options.loading;

  function DynamicWrapper(props: P) {
    return (
      <Suspense fallback={Loading ? <Loading /> : null}>
        <LazyComponent {...props} />
      </Suspense>
    );
  }

  DynamicWrapper.displayName = 'DynamicShim';
  (DynamicWrapper as React.ComponentType<P> & { preload?: () => Promise<unknown> }).preload =
    () => loader();

  return DynamicWrapper;
}
