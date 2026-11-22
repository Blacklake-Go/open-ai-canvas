import Link from 'next/link';

const LOGIN_OPTIONS = [
  {
    href: '/admin/system/login?category=social',
    id: 'social',
    title: '社交登录',
    description: 'Google、X、微信、QQ 等 OAuth 渠道',
  },
  {
    href: '/admin/system/login?category=sms',
    id: 'sms',
    title: '短信登录',
    description: '+86 国内短信与国际手机号验证',
  },
  {
    href: '/admin/system/email',
    id: 'email',
    title: '邮箱登录',
    description: '邮箱账号与 QQ 企业邮箱 SMTP',
  },
];

export default function LoginConfigurationNav({ active }) {
  return (
    <nav aria-label="登录配置" className="grid gap-3 sm:grid-cols-3">
      {LOGIN_OPTIONS.map((option) => {
        const selected = option.id === active;
        return (
          <Link
            key={option.id}
            href={option.href}
            aria-current={selected ? 'page' : undefined}
            className={`rounded-xl border p-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-line ${
              selected
                ? 'border-brand-line bg-brand-soft text-brand-hover'
                : 'border-line bg-base text-ink hover:border-brand-line hover:bg-wash'
            }`}
          >
            <span className="block text-label font-semibold">{option.title}</span>
            <span className="mt-1 block text-body-sm text-ink-muted">{option.description}</span>
          </Link>
        );
      })}
    </nav>
  );
}
