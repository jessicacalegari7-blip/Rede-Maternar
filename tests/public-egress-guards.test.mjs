import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('diretório público não percorre a base inteira',()=>{
  const source=read('src/lib/operations.ts')
  assert.doesNotMatch(source,/page\s*<=\s*20/)
  assert.match(source,/published_clinic_directory'[\s\S]*?\.limit\(24\)/)
  assert.match(source,/requested_page:1,requested_page_size:50/)
})

test('conteúdo editorial público usa API com cache compartilhado',()=>{
  const client=read('src/lib/news.ts')
  const endpoint=read('api/public-content.mjs')
  assert.match(client,/\/api\/public-content\?resource=articles/)
  assert.doesNotMatch(client,/refreshBucket|resource=articles[^`]*[?&]v=/)
  assert.match(client,/PORTAL_CACHE_FRESHNESS_MS = 5 \* 60 \* 1000/)
  assert.match(client,/if\(!response\.ok\)return\[\]/)
  assert.match(endpoint,/s-maxage=21600/)
  assert.match(endpoint,/stale-if-error=604800/)
  assert.match(endpoint,/mapImages\(row,640\)/)
  assert.match(endpoint,/\.eq\('is_demo',false\)/)
  assert.match(read('src/lib/ecosystem.ts'),/resource=ecosystem/)
  assert.match(read('src/pages/public/PortalArticle.tsx'),/publicImageUrl\(image\[2\],1200\)/)
})

test('sitemaps mantêm cache resiliente e selecionam colunas necessárias',()=>{
  const xml=read('api/_lib/sitemap-xml.mjs')
  const handlers=read('api/_lib/sitemap-handlers.mjs')
  assert.match(xml,/stale-if-error=604800/)
  assert.doesNotMatch(handlers,/published_clinic_directory'\)\.select\('\*'\)/)
})

test('proxy de imagens aceita apenas o Storage público do próprio Supabase',()=>{
  const source=read('api/public-image.mjs')
  assert.match(source,/source\.hostname!==supabase\.hostname/)
  assert.match(source,/\/storage\/v1\/object\/public\//)
  assert.match(source,/s-maxage=31536000/)
  assert.match(source,/X-MaterPlace-Image-Source','local-placeholder/)
  assert.match(source,/\[402,429\]/)
  assert.match(source,/\.webp\(\{quality:82\}\)/)
  assert.match(read('src/lib/operations.ts'),/withCachedPublicMedia/)
})

test('snapshot de contingência mantém notícias públicas e vídeos disponíveis',async()=>{
  const fallback=await import('../api/_lib/public-content-fallback.mjs')
  const snapshot=fallback.publicContentFallback()
  assert.ok(snapshot.articles.length>0)
  assert.ok(snapshot.articles.every(item=>item.status==='published'&&!item.is_demo))
  assert.ok(snapshot.articles.every(item=>item.slug&&item.title&&item.content))
  assert.ok(Array.isArray(snapshot.videos))
  assert.match(read('api/public-content.mjs'),/X-MaterPlace-Data-Source','fallback-snapshot/)
  assert.match(read('api/article-share.mjs'),/fallbackArticles\(\)\.find/)
  assert.match(read('api/_lib/sitemap-handlers.mjs'),/fallbackArticles\(\)/)
})
