'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
export default function OAuthAccountsSection() {
  const [data,setData] = useState(null), [options,setOptions] = useState([]), [target,setTarget] = useState(null), [code,setCode] = useState(''), [message,setMessage] = useState(''), [busy,setBusy] = useState(false);
  async function load() {
    const r = await fetch('/api/user/oauth-security',{cache:'no-store'});
    if(r.ok) setData(await r.json());
    const o = await fetch('/api/auth/social-options',{cache:'no-store'});
    if(o.ok) setOptions((await o.json()).providers || []);
  }
  useEffect(() => { load().catch(() => setMessage('暂时无法读取第三方绑定')); }, []);
  async function action(kind) {
    setBusy(true);setMessage('');
    try {
      const r = await fetch('/api/user/oauth-security',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:kind,provider:target,code})});
      const result = await r.json();if(!r.ok)throw new Error(result.error);
      if(kind==='send-code')setMessage('验证码已发送至当前账户已验证的安全邮箱');
      else {setTarget(null);setCode('');await load();}
    }catch(e){setMessage(e.message);}finally{setBusy(false);}
  }
  const ids = [...new Set([...options.filter(o=>o.available).map(o=>o.id),...(data?.accounts||[]).map(a=>a.provider)])];
  return <section className="space-y-4" aria-label="第三方登录账号">
    <h3 className="text-card-title text-ink">第三方登录账号</h3>
    {ids.map(id=>{
      const accounts = data?.accounts.filter(a=>a.provider===id)||[];
      const policy = data?.policies[id];
      const available = options.some(o=>o.id===id&&o.available);
      return <div key={id} className="rounded-xl border border-line p-4 space-y-2">
        <p className="text-body text-ink">{id} · {accounts.length?'已绑定':'未绑定'}</p>
        {accounts.map((a,i)=><p key={i} className="text-body-sm text-ink-muted break-words">{a.display_name || a.provider_username || '提供者未开放账号名'}{a.provider_username&&` · ${a.provider_username}`} · 绑定于 {new Date(a.created_at).toLocaleString()} · 渠道邮箱{a.provider_email_verified?'已验证':'未提供或未验证'}</p>)}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!available||!policy?.allowBind||(accounts.length>0&&!policy?.allowReplace)} onClick={()=>window.location.assign(`/api/auth/oauth/${id}?action=bind&returnTo=${encodeURIComponent(window.location.pathname+window.location.search)}`)}>{accounts.length?'换绑 / 重新授权':'绑定'}</Button>
          {accounts.length>0&&<Button size="sm" variant="ghost" disabled={!policy?.allowUnbind} onClick={()=>{setTarget(id);setCode('');setMessage('');}}>解绑</Button>}
        </div>
      </div>;
    })}
    {!target&&message&&<p role="status" className="text-body-sm text-ink-muted">{message}</p>}
    <Dialog open={Boolean(target)} onOpenChange={open=>{if(!open)setTarget(null);}}><DialogContent>
      <DialogTitle>确认解绑 {target}</DialogTitle><DialogDescription>解绑后，该第三方账号将无法登录本账户。请验证当前安全邮箱；系统会保留至少一种可用登录方式，并刷新登录会话。</DialogDescription>
      <label htmlFor="oauth-unbind-code" className="text-label">安全邮箱验证码</label><Input id="oauth-unbind-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value)} />
      {message&&<p role="status" className="text-body-sm text-ink-muted">{message}</p>}
      <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={()=>action('send-code')}>发送验证码</Button><Button variant="danger" disabled={busy||code.length!==6} onClick={()=>action('unbind')}>确认解绑</Button></div>
    </DialogContent></Dialog>
  </section>;
}
