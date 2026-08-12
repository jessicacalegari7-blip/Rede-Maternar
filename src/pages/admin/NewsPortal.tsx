import { Edit3, Eye, FilePlus2, Newspaper, Save, Trash2, X } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminListArticles, removeArticle, saveArticle, type NewsInput, type NewsStatus, type PortalArticle } from '../../lib/news'

const emptyArticle: NewsInput = { title: '', slug: '', excerpt: '', content: '', category: 'Gestação', coverImageUrl: null, authorName: 'Equipe MaterPlace', status: 'draft', featured: false }

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function AdminNewsPortal() {
  const [articles, setArticles] = useState<PortalArticle[]>([])
  const [editor, setEditor] = useState<NewsInput | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() { setLoading(true); try { setArticles(await adminListArticles()) } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao carregar notícias.') } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])

  function edit(article: PortalArticle) { setEditor({ id: article.id, title: article.title, slug: article.slug, excerpt: article.excerpt, content: article.content, category: article.category, coverImageUrl: article.coverImageUrl, authorName: article.authorName, status: article.status, featured: article.featured }); setMessage('') }
  function field<K extends keyof NewsInput>(key: K, value: NewsInput[K]) { setEditor(current => current ? { ...current, [key]: value } : current) }

  async function submit(event: FormEvent) {
    event.preventDefault(); if (!editor) return
    setMessage('Salvando...')
    try { await saveArticle({ ...editor, slug: editor.slug || slugify(editor.title) }); setMessage('Notícia salva com sucesso.'); setEditor(null); await load() }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a notícia.') }
  }

  async function remove(article: PortalArticle) {
    if (article.isDemo || !window.confirm(`Excluir “${article.title}”?`)) return
    try { await removeArticle(article.id); setMessage('Notícia excluída.'); await load() } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao excluir.') }
  }

  return <div>
    <div className="page-heading"><div><h1>Notícias do portal</h1><p className="muted">Crie e publique conteúdos diretamente dentro da MaterPlace.</p></div><button className="btn btn-primary" onClick={() => setEditor({ ...emptyArticle })}><FilePlus2 /> Nova notícia</button></div>
    {message && <div className="alert">{message}</div>}
    <section className="card news-admin-overview"><div><Newspaper /><span><strong>{articles.length}</strong><small>matérias cadastradas</small></span></div><div><Eye /><span><strong>{articles.reduce((total, item) => total + item.views, 0)}</strong><small>visualizações</small></span></div></section>
    {loading ? <div className="card empty-state">Carregando notícias...</div> : <section className="card news-admin-list">
      {articles.length === 0 && <div className="empty-state"><Newspaper /><h2>Nenhuma notícia cadastrada</h2><p>Crie a primeira publicação da MaterPlace.</p></div>}
      {articles.map(article => <article key={article.id}><div><span className={`badge news-status-${article.status}`}>{article.status === 'published' ? 'Publicada' : article.status === 'draft' ? 'Rascunho' : 'Arquivada'}</span>{article.isDemo && <span className="badge">Demonstrativa</span>}<h3>{article.title}</h3><p>{article.category} · {article.authorName} · {article.views} visualizações</p></div><div className="row">{article.status === 'published' && <Link className="btn btn-secondary" to={`/noticias/${article.slug}`} target="_blank"><Eye /></Link>}<button className="btn btn-secondary" onClick={() => edit(article)}><Edit3 /></button>{!article.isDemo && <button className="btn btn-danger" onClick={() => void remove(article)}><Trash2 /></button>}</div></article>)}
    </section>}

    {editor && <div className="modal-backdrop modal-top"><form className="modal-card news-editor" onSubmit={submit}><div className="modal-head"><div><h2>{editor.id ? 'Editar notícia' : 'Nova notícia'}</h2><p className="muted">O conteúdo será exibido dentro do layout da MaterPlace.</p></div><button type="button" className="icon-button" onClick={() => setEditor(null)}><X /></button></div>
      <div className="form-grid"><label className="field span-2"><span>Título</span><input required value={editor.title} onChange={event => { field('title', event.target.value); if (!editor.id) field('slug', slugify(event.target.value)) }} /></label><label className="field"><span>URL amigável</span><input required value={editor.slug} onChange={event => field('slug', slugify(event.target.value))} /></label><label className="field"><span>Categoria</span><input required value={editor.category} onChange={event => field('category', event.target.value)} /></label><label className="field span-2"><span>Resumo</span><textarea required rows={3} value={editor.excerpt} onChange={event => field('excerpt', event.target.value)} /></label><label className="field span-2"><span>Texto da matéria</span><textarea required rows={13} value={editor.content} onChange={event => field('content', event.target.value)} placeholder="Separe os parágrafos deixando uma linha em branco." /></label><label className="field"><span>Autor</span><input required value={editor.authorName} onChange={event => field('authorName', event.target.value)} /></label><label className="field"><span>Imagem de capa (URL)</span><input value={editor.coverImageUrl || ''} onChange={event => field('coverImageUrl', event.target.value || null)} /></label><label className="field"><span>Status</span><select value={editor.status} onChange={event => field('status', event.target.value as NewsStatus)}><option value="draft">Rascunho</option><option value="published">Publicada</option><option value="archived">Arquivada</option></select></label><label className="news-featured-check"><input type="checkbox" checked={editor.featured} onChange={event => field('featured', event.target.checked)} /> Destacar na home</label></div>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setEditor(null)}>Cancelar</button><button className="btn btn-primary"><Save /> Salvar notícia</button></div>
    </form></div>}
  </div>
}
