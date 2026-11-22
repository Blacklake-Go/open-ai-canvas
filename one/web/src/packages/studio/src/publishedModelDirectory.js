// The published contract supplies model inputs; catalogue names are presentation only.
export function publishedVariantId(modelId, taskType) {
  return `${modelId}::${taskType}`;
}

function schemaFields(schema, taskType) {
  const branches = schema?.anyOf || schema?.oneOf;
  if (branches) {
    return schemaFields(branches.find(branch => schemaFields(branch, taskType).task_type?.const === taskType) || branches[0], taskType);
  }
  return Object.assign({}, ...(schema?.allOf || []).map(branch => schemaFields(branch, taskType)), schema?.properties || {});
}

export function publishedStudioModels(row) {
  if (row?.schemaVersion !== 2 || !row.capabilityVersion || !row.inputSchema) return [];
  return (row.generationCapabilities || []).map(capability => {
    const taskType = capability.taskType;
    const routeSchema = capability.variants?.[0]?.inputSchema || capability.inputSchema;
    const fields = schemaFields(row.inputSchema, taskType);
    const inputs = Object.fromEntries(Object.entries(fields).filter(([key]) => key !== 'task_type').map(([key, value]) => {
      const schema = {...value};
      if (schema.const !== undefined) schema.default = schema.const;
      if (schema.minimum !== undefined) schema.minValue = schema.minimum;
      if (schema.maximum !== undefined) schema.maxValue = schema.maximum;
      if (schema.default === undefined && schema.enum?.length) schema.default = schema.enum[0];
      if (schema.default===undefined && schema.type==='object')schema.default={};
      if (schema.default===undefined && schema.type==='array')schema.default=[];
      if (schema.default===undefined && schema.type==='boolean')schema.default=false;
      if (schema['x-inputRole']) schema.field = schema['x-inputRole'];
      return [key, schema];
    }));
    inputs.prompt ||= {type:'string', title:'提示词'};
    const fixedParameters=Object.fromEntries(Object.entries(fields).filter(([,schema])=>schema.const!==undefined).map(([key,schema])=>[key,schema.const]));
    const mediaFields=Object.fromEntries(['image','video','audio'].map(type=>[`${type}Field`,Object.keys(inputs).find(key=>inputs[key].field===type)]).filter(([,field])=>field));
    return {
      id: publishedVariantId(row.id, taskType), endpoint: row.id, canonicalModelId: row.id,
      name: row.displayName || row.name || row.id, description: row.description,
      provider: row.provider, family: row.id, published: true, taskType,
      capabilityVersion: row.capabilityVersion, inputs,
      required: row.inputSchema.required || routeSchema?.required || [], fixedParameters:{...fixedParameters,task_type:taskType},
      ...mediaFields,
    };
  });
}
