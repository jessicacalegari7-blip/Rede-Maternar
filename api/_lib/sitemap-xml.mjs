export const SITE_URL = 'https://materplace.com.br'
export const MAX_URLS = 50000

export const escapeXml = value => String(value ?? '').replace(/[<>&'"]/g, char => ({
  '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;',
}[char]))

export const isoDate = value => {
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

export const urlNode = ({ loc, lastmod, changefreq = 'weekly', priority = '0.5' }) =>
  `<url><loc>${escapeXml(loc)}</loc><lastmod>${isoDate(lastmod)}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`

export const urlset = nodes => `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${nodes.join('')}</urlset>`

export function sendXml(response, xml, cacheSeconds = 900) {
  response.setHeader('Content-Type', 'application/xml; charset=utf-8')
  response.setHeader('Cache-Control', `public, max-age=0, s-maxage=${cacheSeconds}, stale-while-revalidate=3600`)
  return response.status(200).send(xml)
}

export const pageNumber = request => Math.max(1, Number(request.query?.page || 1) || 1)

export async function fetchRange(buildQuery, page, pageSize = MAX_URLS) {
  const offset = (page - 1) * pageSize
  const rows = []
  for (let cursor = offset; cursor < offset + pageSize; cursor += 1000) {
    const end = Math.min(cursor + 999, offset + pageSize - 1)
    const { data, error } = await buildQuery().range(cursor, end)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < end - cursor + 1) break
  }
  return rows
}
