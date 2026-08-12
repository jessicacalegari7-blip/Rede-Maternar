export function json(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

export function allowMethods(req, res, methods) {
  if (methods.includes(req.method)) return true
  res.setHeader('allow', methods.join(', '))
  json(res, 405, { error: 'Método não permitido.' })
  return false
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body
  let raw = ''
  for await (const chunk of req) raw += chunk
  return raw ? JSON.parse(raw) : {}
}

