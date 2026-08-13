import { Edit3, Eye, FilePlus2, ImagePlus, Newspaper, Play, Save, Trash2, Upload, X } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminListArticles, listPortalVideos, removeArticle, removePortalVideo, saveArticle, savePortalVideo, uploadNewsImage, type NewsInput, type NewsStatus, type PortalArticle, type PortalVideo } from '../../lib/news'

const emptyArticle: NewsInput = { title: '', slug: '', excerpt: '', content: '', category: 'Gestação', coverImageUrl: null, authorName: 'Equipe MaterPlace', status: 'draft', featured: false }

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function AdminNewsPortal() {
  const [articles, setArticles] = useState<PortalArticle[]>([])
  const [editor, setEditor] = useState<NewsInput | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [videos,setVideos]=useState<PortalVideo[]>([])
  const [videoEditor,setVideoEditor]=useState<{id?:string;title:string;description:string;youtubeUrl:string;published:boolean;featured:boolean}|null>(null)
  const [uploading,setUploading]=useState(false)
  const [contentCursor,setContentCursor]=useState(0)

  async function load() { setLoading(true); try { const [news,videoItems]=await Promise.all([adminListArticles(),listPortalVideos(true)]);setArticles(news);setVideos(videoItems) } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao carregar notícias.') } finally { setLoading(false) } }
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

  async function upload(file:File|undefined,placement:'cover'|'body') { if(!file||!editor)return;setUploading(true);try{const url=await uploadNewsImage(file);if(placement==='cover')field('coverImageUrl',url);else{const markdown=`\n\n![Descrição da imagem](${url})\n\n`;field('content',editor.content.slice(0,contentCursor)+markdown+editor.content.slice(contentCursor));setContentCursor(contentCursor+markdown.length)}setMessage('Imagem enviada com sucesso.')}catch(error){setMessage(error instanceof Error?error.message:'Falha ao enviar imagem.')}finally{setUploading(false)} }
  async function submitVideo(event:FormEvent){event.preventDefault();if(!videoEditor)return;try{await savePortalVideo(videoEditor);setVideoEditor(null);setMessage('Vídeo salvo com sucesso.');await load()}catch(error){setMessage(error instanceof Error?error.message:'Falha ao salvar vídeo.')}}

  return <div>
    <div className="page-heading"><div><h1>Notícias do portal</h1><p className="muted">Crie e publique conteúdos diretamente dentro da MaterPlace.</p></div><button className="btn btn-primary" onClick={() => setEditor({ ...emptyArticle })}><FilePlus2 /> Nova notícia</button></div>
    {message && <div className="alert">{message}</div>}
    <section className="card news-admin-overview"><div><Newspaper /><span><strong>{articles.length}</strong><small>matérias cadastradas</small></span></div><div><Eye /><span><strong>{articles.reduce((total, item) => total + item.views, 0)}</strong><small>visualizações</small></span></div></section>
    {loading ? <div className="card empty-state">Carregando notícias...</div> : <section className="card news-admin-list">
      {articles.length === 0 && <div className="empty-state"><Newspaper /><h2>Nenhuma notícia cadastrada</h2><p>Crie a primeira publicação da MaterPlace.</p></div>}
      {articles.map(article => <article key={article.id}><div><span className={`badge news-status-${article.status}`}>{article.status === 'published' ? 'Publicada' : article.status === 'draft' ? 'Rascunho' : 'Arquivada'}</span>{article.isDemo && <span className="badge">Demonstrativa</span>}<h3>{article.title}</h3><p>{article.category} · {article.authorName} · {article.views} visualizações</p></div><div className="row">{article.status === 'published' && <Link className="btn btn-secondary" to={`/noticias/${article.slug}`} target="_blank"><Eye /></Link>}<button className="btn btn-secondary" onClick={() => edit(article)}><Edit3 /></button><button className="btn btn-danger" title="Excluir notícia" onClick={() => void remove(article).then(load)}><Trash2 /></button></div></article>)}
    </section>}
    <div className="section-heading news-video-heading"><div><h2>Vídeos do YouTube</h2><p className="muted">Os vídeos publicados aparecem automaticamente na home.</p></div><button className="btn btn-secondary" onClick={()=>setVideoEditor({title:'',description:'',youtubeUrl:'',published:true,featured:false})}><Play/> Novo vídeo</button></div>
    <section className="card news-admin-list">{!videos.length&&<div className="empty-state"><Play/><h3>Nenhum vídeo cadastrado</h3></div>}{videos.map(video=><article key={video.id}><div><span className="badge">{video.published?'Publicado':'Rascunho'}</span><h3>{video.title}</h3><p>{video.description}</p></div><div className="row"><a className="btn btn-secondary" href={`https://youtube.com/watch?v=${video.youtubeId}`} target="_blank" rel="noreferrer"><Eye/></a><button className="btn btn-secondary" onClick={()=>setVideoEditor({id:video.id,title:video.title,description:video.description,youtubeUrl:`https://youtube.com/watch?v=${video.youtubeId}`,published:video.published,featured:video.featured})}><Edit3/></button><button className="btn btn-danger" onClick={()=>void removePortalVideo(video.id).then(load)}><Trash2/></button></div></article>)}</section>

    {editor && <div className="modal-backdrop modal-top"><form className="modal-card news-editor" onSubmit={submit}><div className="modal-head"><div><h2>{editor.id ? 'Editar notícia' : 'Nova notícia'}</h2><p className="muted">O conteúdo será exibido dentro do layout da MaterPlace.</p></div><button type="button" className="icon-button" onClick={() => setEditor(null)}><X /></button></div>
      <div className="form-grid"><label className="field span-2"><span>Título</span><input required value={editor.title} onChange={event => { field('title', event.target.value); if (!editor.id) field('slug', slugify(event.target.value)) }} /></label><label className="field"><span>URL amigável</span><input required value={editor.slug} onChange={event => field('slug', slugify(event.target.value))} /></label><label className="field"><span>Categoria</span><input required value={editor.category} onChange={event => field('category', event.target.value)} /></label><label className="field span-2"><span>Resumo</span><textarea required rows={3} value={editor.excerpt} onChange={event => field('excerpt', event.target.value)} /></label><label className="field span-2"><span>Texto da matéria</span><textarea required rows={13} value={editor.content} onSelect={event=>setContentCursor(event.currentTarget.selectionStart)} onChange={event => field('content', event.target.value)} placeholder="Separe parágrafos com uma linha em branco. Use ## para subtítulos H2 e ### para subtítulos H3." /><span className="editor-upload-row"><label className="btn btn-secondary"><ImagePlus/> Inserir imagem aqui<input type="file" accept="image/*" hidden onChange={event=>void upload(event.target.files?.[0],'body')}/></label><small>Use ## Subtítulo principal (H2) e ### Subtítulo secundário (H3). Posicione o cursor antes de inserir imagens.</small></span></label><label className="field"><span>Autor</span><input required value={editor.authorName} onChange={event => field('authorName', event.target.value)} /></label><label className="field"><span>Imagem de capa</span><label className="news-cover-upload"><Upload/>{uploading?'Enviando...':'Escolher imagem'}<input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={uploading} onChange={event=>void upload(event.target.files?.[0],'cover')}/></label><small>Ideal: 1600 × 900 px, JPG/WebP, até 500 KB.</small>{editor.coverImageUrl&&<img src={editor.coverImageUrl} alt="Prévia da capa"/>}</label><label className="field"><span>Status</span><select value={editor.status} onChange={event => field('status', event.target.value as NewsStatus)}><option value="draft">Rascunho</option><option value="published">Publicada</option><option value="archived">Arquivada</option></select></label><label className="news-featured-check"><input type="checkbox" checked={editor.featured} onChange={event => field('featured', event.target.checked)} /> Destacar na home</label></div>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setEditor(null)}>Cancelar</button><button className="btn btn-primary"><Save /> Salvar notícia</button></div>
    </form></div>}
    {videoEditor&&<div className="modal-backdrop modal-top"><form className="modal-card small" onSubmit={submitVideo}><div className="modal-head"><div><h2>Cadastrar vídeo</h2><p className="muted">Cole o link ou código de incorporação do YouTube.</p></div><button type="button" className="icon-button" onClick={()=>setVideoEditor(null)}><X/></button></div><div className="stack"><label className="field"><span>Título</span><input required value={videoEditor.title} onChange={e=>setVideoEditor({...videoEditor,title:e.target.value})}/></label><label className="field"><span>Link ou incorporar do YouTube</span><textarea required rows={3} value={videoEditor.youtubeUrl} onChange={e=>setVideoEditor({...videoEditor,youtubeUrl:e.target.value})}/></label><label className="field"><span>Descrição</span><textarea rows={3} value={videoEditor.description} onChange={e=>setVideoEditor({...videoEditor,description:e.target.value})}/></label><label className="news-featured-check"><input type="checkbox" checked={videoEditor.published} onChange={e=>setVideoEditor({...videoEditor,published:e.target.checked})}/> Publicar na home</label><label className="news-featured-check"><input type="checkbox" checked={videoEditor.featured} onChange={e=>setVideoEditor({...videoEditor,featured:e.target.checked})}/> Destacar primeiro</label></div><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={()=>setVideoEditor(null)}>Cancelar</button><button className="btn btn-primary"><Save/> Salvar vídeo</button></div></form></div>}
  </div>
}
