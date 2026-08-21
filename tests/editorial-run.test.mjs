import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanText, rssItems, similarity, validateDraft } from '../api/editorial-run.mjs'

test('limpa HTML e interpreta itens RSS', () => {
  assert.equal(cleanText('<p>Saúde &amp; cuidado</p>'), 'Saúde & cuidado')
  const items = rssItems('<rss><item><title><![CDATA[Gestação segura]]></title><link>https://gov.br/a</link><description>Orientação</description><pubDate>Thu, 20 Aug 2026 10:00:00 GMT</pubDate></item></rss>', 'Fonte')
  assert.equal(items[0].title, 'Gestação segura')
  assert.equal(items[0].publisher, 'Fonte')
})

test('detecção de similaridade reconhece títulos equivalentes', () => {
  assert.ok(similarity('Vacinação infantil contra sarampo em Campinas', 'Sarampo: vacinação infantil em Campinas') > 0.5)
})

test('quality gate aceita somente dossiê sustentado por fonte primária', () => {
  const sources = [
    { url: 'https://www.gov.br/saude/a', sourceType: 'primary' },
    { url: 'https://agenciabrasil.ebc.com.br/a', sourceType: 'press' },
  ]
  const draft = { title: 'Nova orientação para famílias', slug: 'nova-orientacao-familias', excerpt: 'Resumo', content_html: `<p>${'palavra '.repeat(700)}</p>`, source_urls: sources.map(source => source.url), facts: [{ claim: 'Fato', status: 'SUPPORTED', source_urls: [sources[0].url] }], editorial_score: 80 }
  assert.deepEqual(validateDraft(draft, sources, []), [])
  assert.ok(validateDraft({ ...draft, source_urls: ['https://invalido.test'] }, sources, []).length > 0)
})
