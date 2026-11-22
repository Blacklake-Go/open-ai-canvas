'use client';
import {useState} from 'react';
import Link from 'next/link';
import {Card,Button,StatusBadge} from '@/components/admin/AdminUi';

const field='w-full rounded-xl border border-line bg-well px-3 py-2 text-sm text-ink outline-none focus:border-brand';
const steps=[['供应商与执行凭据','/admin/models/providers'],['导入模型与能力','/admin/models/catalog'],['成本与积分售价','/admin/models/pricing'],['路由与调度','/admin/models/routing']];

export default function PublicationClient({models,canWrite,canTest}){
  const [modelId,setModelId]=useState(''),[parameters,setParameters]=useState('{}'),[prompt,setPrompt]=useState('');
  const [report,setReport]=useState(null),[quote,setQuote]=useState(null),[task,setTask]=useState(null);
  const [budget,setBudget]=useState(''),[spendConfirmed,setSpendConfirmed]=useState(false),[reviewed,setReviewed]=useState(false);
  const [sites,setSites]=useState(['main','canvas']),[audience,setAudience]=useState('all'),[userIds,setUserIds]=useState('');
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const request=async(action,extra={})=>{
    const response=await fetch('/api/admin/models/publication',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({action,modelId,...extra})});
    const body=await response.json();
    if(!response.ok)throw new Error(body.error?.message || '操作未完成');
    return body.data;
  };
  const run=async(action)=>{
    setBusy(true);setNotice('');
    try{
      if(action==='inspect')setReport(await request(action,{parameters:JSON.parse(parameters)}));
      if(action==='prepare_test'){await request(action);setNotice('已转入隐藏测试阶段，尚未向用户开放。');}
      if(action==='quote_test'){setQuote(await request(action,{parameters:JSON.parse(parameters)}));setSpendConfirmed(false);}
      if(action==='submit_test'){
        if(!spendConfirmed)throw new Error('请明确确认本次测试消耗及积分上限');
        const result=await request(action,{parameters:JSON.parse(parameters),prompt,quoteId:quote.quoteId,maxCredits:Number(budget)});
        setTask({id:result.creation.id,status:result.creation.status});setQuote(null);setReviewed(false);setNotice('测试任务已创建。请查询原任务，不要重复提交。');
      }
      if(action==='read_test')setTask(await request(action,{creationId:task.id}));
      if(action==='record_test'){await request(action,{creationId:task.id,resultReviewed:reviewed});setReport(await request('inspect'));setNotice('测试凭据已记录，可继续检查发布条件。');}
      if(action==='publish'){
        await request(action,{policy:{sites,audience,userIds:audience==='allowlist' ? userIds.split(/[\s,，]+/).filter(Boolean) : []}});
        setReport(await request('inspect'));setNotice('已按所选站点和用户范围发布；Canvas 挂载与默认模型在同一事务中更新。');
      }
    }catch(error){setNotice(error.message);}finally{setBusy(false);}
  };
  return <div className="space-y-5">
    <nav aria-label="模型接入步骤" className="flex flex-wrap gap-3 text-sm">{steps.map(([label,href],index)=><Link key={href} href={href} className="text-brand hover:underline">{index+1}. {label}</Link>)}</nav>
    <Card><div className="space-y-4">
      <label className="block text-sm text-ink">选择规范模型<select className={field} value={modelId} onChange={event=>{setModelId(event.target.value);setReport(null);setQuote(null);setTask(null);setReviewed(false);}}><option value="">请选择</option>{models.map(model=><option key={model.id} value={model.id}>{model.display_name || model.name} · {model.category} · {model.status}</option>)}</select></label>
      <label className="block text-sm text-ink">测试参数<textarea aria-label="测试参数" className={`${field} min-h-28 font-mono`} value={parameters} onChange={event=>{setParameters(event.target.value);setQuote(null);setSpendConfirmed(false);}}/></label>
      <p className="text-xs text-ink-muted">按能力检查返回的参数配置填写。检查与报价不创建上游任务，也不冻结积分。</p>
      <div className="flex flex-wrap gap-2"><Button disabled={!modelId || busy} onClick={()=>run('inspect')}>检查能力与发布条件</Button>{canWrite && <Button disabled={!modelId || busy} onClick={()=>run('prepare_test')}>准备隐藏模型测试</Button>}</div>
    </div></Card>
    {report && <Card><div className="space-y-3"><h2 className="text-base font-semibold text-ink">发布检查</h2>{report.checks.map(check=><div key={check.code} className="flex items-center gap-3 text-sm"><StatusBadge tone={check.passed ? 'good' : 'warn'}>{check.passed ? '通过' : '待处理'}</StatusBadge><span>{check.message}</span></div>)}{report.providers.map(provider=><p key={provider.providerId} className="text-xs text-ink-muted">{provider.providerId}：{provider.configured ? `执行凭据来自 ${provider.source}` : '未配置可执行凭据'}；供应商连通性以线路健康及实际测试为准。</p>)}<details><summary className="cursor-pointer text-sm text-ink-muted">查看已发布能力与参数</summary><pre className="max-h-80 overflow-auto rounded-xl bg-well p-3 text-xs text-ink">{JSON.stringify(report.descriptor.inputSchema,null,2)}</pre></details></div></Card>}
    {canWrite && canTest && <Card><div className="space-y-4"><h2 className="text-base font-semibold text-ink">测试与结果核对</h2><label className="block text-sm">测试提示词<textarea className={field} value={prompt} onChange={event=>setPrompt(event.target.value)}/></label><Button disabled={!modelId || busy} onClick={()=>run('quote_test')}>获取测试报价</Button>
      {quote && <div className="space-y-3 rounded-xl border border-line-subtle p-4"><p className="text-sm">本次报价 {quote.credits} 积分，有效至 {new Date(quote.expiresAt).toLocaleString()}。</p><label className="block text-sm">本次测试积分上限<input type="number" min="1" step="1" className={field} value={budget} onChange={event=>setBudget(event.target.value)}/></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={spendConfirmed} onChange={event=>setSpendConfirmed(event.target.checked)}/>确认使用当前账户积分执行一次真实供应商测试</label><Button disabled={busy || !spendConfirmed || Number(budget)<quote.credits} onClick={()=>run('submit_test')}>确认并创建测试任务</Button></div>}
      {task && <div className="space-y-3"><p className="text-sm">任务 {task.id} · {task.status}</p><Button disabled={busy} onClick={()=>run('read_test')}>查询原任务与结果</Button>{task.text && <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-well p-3 text-sm">{task.text}</pre>}{task.assetDownloadUrl && <a href={task.assetDownloadUrl} target="_blank" rel="noreferrer" className="block text-sm text-brand underline">查看归档素材</a>}{task.status==='succeeded' && <><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={event=>setReviewed(event.target.checked)}/>已查看文本或读取归档素材并核对结果</label><Button disabled={busy || !reviewed} onClick={()=>run('record_test')}>记录测试凭据</Button></>}</div>}
    </div></Card>}
    {canWrite && <Card><div className="space-y-4"><h2 className="text-base font-semibold text-ink">开放范围与发布</h2><div className="flex gap-4">{[['main','主站'],['canvas','Canvas']].map(([site,label])=><label key={site} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sites.includes(site)} onChange={event=>setSites(current=>event.target.checked ? [...current,site] : current.filter(value=>value!==site))}/>{label}</label>)}</div><label className="block text-sm">用户范围<select className={field} value={audience} onChange={event=>setAudience(event.target.value)}><option value="all">所有用户</option><option value="paid">有效订阅用户</option><option value="allowlist">指定测试用户</option></select></label>{audience==='allowlist' && <label className="block text-sm">用户 ID<input className={field} value={userIds} onChange={event=>setUserIds(event.target.value)} placeholder="用逗号或空格分隔"/></label>}<Button disabled={busy || !report?.ready || !sites.length} onClick={()=>run('publish')}>按所选范围发布</Button></div></Card>}
    {notice && <p role="status" className="text-sm text-ink-muted">{notice}</p>}
  </div>;
}
