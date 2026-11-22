export function modelPublicationPolicy(model) {
  let metadata=model?.metadata_json || model?.capabilities || {};
  if(typeof metadata==='string'){try{metadata=JSON.parse(metadata);}catch{metadata={};}}
  const policy=metadata.publicationPolicy;
  return policy && typeof policy==='object' ? policy : {sites:['main','canvas'],audience:'all',userIds:[]};
}

export function isModelPublishedToSite(model,site) {
  return modelPublicationPolicy(model).sites?.includes(site) === true;
}

export function isModelAudienceAllowed(model,{userId=null,isPaid=false}={}) {
  const policy=modelPublicationPolicy(model);
  if(policy.audience==='all')return true;
  if(policy.audience==='paid')return Boolean(userId && isPaid);
  return policy.audience==='allowlist' && Boolean(userId && policy.userIds?.includes(String(userId)));
}

export function validateModelPublicationPolicy(policy) {
  return Boolean(policy && Array.isArray(policy.sites) && policy.sites.length && new Set(policy.sites).size===policy.sites.length
    && policy.sites.every(site=>['main','canvas'].includes(site)) && ['all','paid','allowlist'].includes(policy.audience)
    && Array.isArray(policy.userIds) && policy.userIds.every(id=>typeof id==='string' && /^\d+$/.test(id))
    && (policy.audience!=='allowlist' || policy.userIds.length));
}
