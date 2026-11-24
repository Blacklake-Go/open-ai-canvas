import { apiRequest } from './http';

const root = '/api/one/agents';

export const agentPath = slug => `${root}/${encodeURIComponent(slug)}`;

function request(path, owner, options = {}) {
  const headers = owner ? { 'X-ONE-Expected-User': String(owner) } : undefined;
  return apiRequest(path, { ...options, headers, cache: 'no-store' });
}

export const agentPersona = {
  templates: signal => request(`${root}/templates`, undefined, { signal }),
  profiles: (owner, signal) => request(root, owner, { signal }),
  conversations: (owner, signal) => request(`${root}/conversations`, owner, { signal }),
  profile: (owner, slug, signal) => request(agentPath(slug), owner, { signal }),
  create: (owner, body) => request(root, owner, { method: 'POST', body }),
  update: (owner, slug, body) => request(agentPath(slug), owner, { method: 'PUT', body }),
  openConversation: (owner, slug, body) => request(`${agentPath(slug)}/conversations`, owner, { method: 'POST', body }),
};
