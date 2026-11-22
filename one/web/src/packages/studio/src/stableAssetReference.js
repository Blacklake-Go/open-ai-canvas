// Old persisted storage URLs can expire while a draft is idle or a job queues.
// Do not submit them as if they were durable asset references.
export function hasTemporaryReferenceUrl(values) {
  return (values || []).some((value) => {
    if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return false;
    try {
      const params = new URL(value).searchParams;
      return [...params.keys()].some((key) => /^(?:x-amz-signature|x-goog-signature|q-signature|signature|ossaccesskeyid)$/i.test(key));
    } catch {
      return false;
    }
  });
}
