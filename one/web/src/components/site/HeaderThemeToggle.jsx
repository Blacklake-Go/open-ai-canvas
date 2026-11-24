import { flushSync } from 'react-dom';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { FOCUS_RING } from 'studio/ui/tokens';
import { getMegaNavCopy } from '@/config/mega-navigation';

let transitionInProgress = false;

export default function HeaderThemeToggle({ locale }) {
  const { resolvedTheme, setTheme } = useTheme();
  const nextTheme = resolvedTheme === 'light' ? 'dark' : 'light';
  const Icon = nextTheme === 'light' ? Sun : Moon;
  const label = getMegaNavCopy(locale).theme[nextTheme];

  function changeTheme(event) {
    if (transitionInProgress) return;
    const root = document.documentElement;
    if (!document.startViewTransition || root.classList.contains('no-motion')
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTheme(nextTheme);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    transitionInProgress = true;
    root.classList.add('theme-transitioning');
    const transition = document.startViewTransition(() => flushSync(() => setTheme(nextTheme)));
    const themeDuration = Number.parseFloat(getComputedStyle(root).getPropertyValue('--motion-theme'));
    transition.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: themeDuration, easing: 'ease-out', pseudoElement: '::view-transition-new(root)' },
      );
    }).catch(() => {});
    transition.finished.catch(() => {}).finally(() => {
      root.classList.remove('theme-transitioning');
      transitionInProgress = false;
    });
  }

  return (
    <button type="button" aria-label={label} title={label} onClick={changeTheme}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-wash hover:text-ink ${FOCUS_RING}`}>
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
