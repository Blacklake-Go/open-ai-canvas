'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export default function OAuthOnboarding() {
  const [info, setInfo] = useState(null);
  const [displayName, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [accountAction, setAction] = useState('create');
  const [confirmReplace, setReplace] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch('/api/auth/oauth/onboarding', { cache:'no-store' }).then(async r => {
      const data = await r.json(); if (!r.ok) throw new Error(data.error);
      setInfo(data); setName(data.displayName || ''); setEmail(data.email || '');
    }).catch(e => setMessage(e.message));
  }, []);
  async function submit(action) {
    setBusy(true); setMessage('');
    try {
      const r = await fetch('/api/auth/oauth/onboarding', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ action, displayName, email, code, accountAction, confirmReplace }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error);
      if (action === 'send-code') setMessage('验证码已发送，请查收邮箱。已有账户请使用原账户的安全邮箱。');
      else {
        const origin = data.returnOrigin || window.location.origin;
        const event = {type:'supdance-auth-complete',eventId:crypto.randomUUID(),ok:true,action:data.action,provider:data.provider,isNew:data.isNew,user:data.user,targetUrl:origin+data.returnTo};
        try { const channel = new BroadcastChannel('supdance_auth_channel'); channel.postMessage(event); channel.close(); localStorage.setItem('supdance_auth_event',JSON.stringify({...event,_time:Date.now()})); } catch {}
        if (window.opener) {
          window.opener.postMessage(event,origin);
          window.close();
        }
        window.location.replace(origin+data.returnTo);
      }
    } catch(e) { setMessage(e.message); } finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-base px-4 py-8 flex items-center justify-center">
    <section className="w-full max-w-lg rounded-2xl border border-line bg-overlay p-6 shadow-elevation-4 space-y-4" aria-labelledby="oauth-title">
      <h1 id="oauth-title" className="text-section-title text-ink">确认账号与安全邮箱</h1>
      <p className="text-body-sm text-ink-muted">{info ? `${info.provider} 授权成功。请确认以下信息后继续。` : '正在读取授权信息…'}</p>
      <p className="text-body-sm text-ink-muted">完成验证前，此授权不能用于访问账户、资产或生成服务。相同邮箱的已有账户需要再次验证邮箱，才能关联。</p>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); submit('complete'); }}>
        <div className="space-y-2"><label htmlFor="oauth-name" className="text-label text-ink">账号显示名</label><Input id="oauth-name" required minLength={2} maxLength={64} value={displayName} onChange={e => setName(e.target.value)} disabled={!info || busy} /></div>
        <div className="space-y-2"><label htmlFor="oauth-email" className="text-label text-ink">安全邮箱</label><Input id="oauth-email" type="email" autoComplete="email" required maxLength={128} value={email} onChange={e => { setEmail(e.target.value); setCode(''); }} disabled={!info || busy} /></div>
        <p className="text-caption text-ink-muted">{info?.providerEmailVerified ? '提供者已返回邮箱验证声明。关联已有账户或更改邮箱时仍须本地验证。' : '此渠道没有提供可信的已验证邮箱，请设置邮箱并完成验证码验证。'}</p>
        {!info?.bind && <Select value={accountAction} onValueChange={setAction}><SelectTrigger aria-label="账户处理方式"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="create">创建新账户</SelectItem><SelectItem value="link">验证并绑定已有邮箱账户</SelectItem></SelectContent></Select>}
        <div className="space-y-2"><label htmlFor="oauth-code" className="text-label text-ink">邮箱验证码</label><div className="flex flex-wrap gap-2"><Input id="oauth-code" className="flex-1" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value)} disabled={busy} /><Button type="button" onClick={() => submit('send-code')} disabled={!info || !email || busy}>发送验证码</Button></div></div>
        {info?.bind && <label className="flex items-center gap-2 text-body-sm text-ink-muted"><Switch aria-label="确认替换当前渠道原有绑定" checked={confirmReplace} onCheckedChange={setReplace} />确认替换当前渠道原有绑定</label>}
        {message && <p role="status" className="text-body-sm text-ink-muted">{message}</p>}
        <Button variant="primary" type="submit" className="w-full" loading={busy} disabled={!info || busy}>确认并继续</Button>
      </form>
      <Button variant="ghost" onClick={() => window.location.replace('/login')}>取消并返回登录</Button>
    </section>
  </main>;
}
