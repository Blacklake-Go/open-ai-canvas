import { useEffect, useState } from 'react';
import { Dialog } from 'radix-ui';
import { ChevronDown, ExternalLink, Menu } from 'lucide-react';
import Link from 'next/link';
import { useLocation } from 'react-router';
import { Drawer, DrawerContent } from 'studio/ui/overlay';
import { FOCUS_RING } from 'studio/ui/tokens';
import { useTopNavigation } from './useTopNavigation';

const rowClass = `flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 py-2 text-body-sm text-ink hover:bg-wash aria-[current=page]:bg-wash-strong ${FOCUS_RING}`;

export default function MobileTopNavigation({ locale, activeTab, customItems, studioItems = [] }) {
  const [open, setOpen] = useState(false);
  const { pathname, search } = useLocation();
  const { copy, menuCopy, homeHref, assetsHref, categories, shortcuts, about, restricted } = useTopNavigation(locale);
  const labels = copy.topNav;
  const model = new URLSearchParams(search).get('model');

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  useEffect(() => setOpen(false), [pathname, search]);

  const renderLink = (item) => {
    const current = item.active ?? (item.tabId
      ? activeTab === item.tabId && (item.modelKey ? model === item.modelKey : !model)
      : item.href === pathname + search);
    return (
      <Link
        key={item.id || item.href}
        href={item.href}
        target={item.target}
        rel={item.target === '_blank' ? 'noopener noreferrer' : undefined}
        aria-current={current ? 'page' : undefined}
        className={rowClass}
        onClick={() => setOpen(false)}
      >
        <span>{item.label}</span>
        {item.target === '_blank' && <ExternalLink className="size-4 text-ink-muted" aria-hidden="true" />}
      </Link>
    );
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className={`inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-wash hover:text-ink lg:hidden ${FOCUS_RING}`} aria-label={copy.shell.toggleNavMenu}>
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </Dialog.Trigger>
      <DrawerContent side="left" title={menuCopy.navigation} aria-describedby={undefined} className="lg:hidden">
        <nav aria-label={menuCopy.navigation} className="space-y-1">
          {customItems ? customItems.map(renderLink) : (
            <>
              {renderLink({ label: labels.home, href: homeHref })}
              {renderLink({ label: labels.assets, href: assetsHref })}
              {categories.map((category) => {
                if (!category.features.length && !category.models.length) return renderLink(category);
                return (
                  <details key={category.id} open={category.features.some((item) => (item.tabId && item.tabId === activeTab) || item.href === pathname + search)} className="group">
                    <summary className={`${rowClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
                      {category.label}
                      <ChevronDown className="size-4 text-ink-muted group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <div className="ml-3 border-l border-line pl-2">
                      {category.features.map(renderLink)}
                      {category.models.length > 0 && (
                        <details>
                          <summary className={`${rowClass} cursor-pointer`}>{menuCopy.models}</summary>
                          {category.models.map(renderLink)}
                        </details>
                      )}
                    </div>
                  </details>
                );
              })}
              {!restricted && studioItems.map(renderLink)}
              {!restricted && renderLink({ label: labels.infiniteCanvas, href: '/canvas', target: '_blank' })}
              {shortcuts.map(renderLink)}
              {renderLink({ label: labels.feedback, href: '/feedback' })}
              {about && renderLink(about)}
            </>
          )}
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
