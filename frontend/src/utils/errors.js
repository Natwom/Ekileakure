// FastAPI returns `detail` as a string (HTTPException) or an array (422 validation)
export const errorText = (err, fallback) => {
  const d = err.response?.data?.detail
  if (Array.isArray(d)) {
    return d.map((x) => `${(x.loc || []).slice(1).join('.')}: ${x.msg}`).join(' | ')
  }
  return typeof d === 'string' ? d : fallback
}