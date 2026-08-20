import { isSupabaseConfigured, supabase } from './supabase'

export type NewsStatus = 'draft' | 'published' | 'archived'

export interface PortalArticle {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  category: string
  coverImageUrl: string | null
  authorName: string
  status: NewsStatus
  featured: boolean
  publishedAt: string | null
  createdAt: string
  isDemo: boolean
  views: number
}

export interface PortalVideo { id:string; title:string; description:string; youtubeId:string; published:boolean; featured:boolean; createdAt:string }

export type NewsInput = Pick<PortalArticle, 'title' | 'slug' | 'excerpt' | 'content' | 'category' | 'coverImageUrl' | 'authorName' | 'status' | 'featured'> & { id?: string }

const demoContent = {
  prenatal: `O acompanhamento pré-natal é uma das principais formas de proteger a saúde da mãe e do bebê durante toda a gestação.

As consultas permitem acompanhar o desenvolvimento do bebê, identificar fatores de risco e orientar a família sobre alimentação, vacinas, exames e preparação para o parto.

Mesmo quando a gestação parece tranquila, manter o calendário de consultas é essencial. Cada encontro oferece uma oportunidade para esclarecer dúvidas e reconhecer mudanças que merecem atenção.

Procure sempre profissionais habilitados e siga as orientações individualizadas para a sua realidade.`,
  breastfeeding: `Amamentar é um processo de aprendizado para a mãe e para o bebê. Desconfortos persistentes não devem ser considerados normais e podem indicar dificuldades na pega ou no posicionamento.

Buscar apoio especializado logo nos primeiros sinais de dor pode prevenir fissuras e tornar a experiência mais tranquila. Ajustes simples costumam produzir uma grande diferença.

Cada dupla tem seu próprio ritmo. Informação confiável, acolhimento e uma rede de apoio ajudam a construir uma jornada possível e respeitosa.`,
  development: `O desenvolvimento infantil acontece de maneira contínua e cada criança possui seu próprio ritmo.

Nos primeiros meses, movimentos, interação com rostos, sons e tentativas de comunicação são sinais importantes. A observação cotidiana ajuda a família a reconhecer conquistas e compartilhar dúvidas com o pediatra.

Comparações rígidas devem ser evitadas. Quando houver preocupação, uma avaliação profissional é o caminho mais seguro para orientar os próximos passos.`,
  vaccines: `Manter a vacinação em dia protege a criança e toda a comunidade contra doenças que podem causar complicações graves.

A caderneta deve ser levada às consultas e às unidades de saúde para conferência. Em caso de atraso, a equipe poderá orientar como atualizar as doses.

Informações sobre vacinas devem ser verificadas em fontes oficiais e com profissionais de saúde.`,
  leave: `Conhecer os direitos relacionados à licença-maternidade ajuda a família a se organizar para a chegada do bebê.

As regras podem variar conforme o vínculo de trabalho e a situação previdenciária. Por isso, é importante consultar os canais oficiais e, quando necessário, buscar orientação especializada.

Planejamento antecipado reduz incertezas e permite que a família concentre energia no cuidado durante as primeiras semanas.`,
  feeding: `A introdução alimentar é uma fase de descobertas que complementa o aleitamento e apresenta novos sabores, aromas e texturas.

O momento adequado e a forma de oferecer os alimentos devem considerar o desenvolvimento da criança e a orientação dos profissionais que a acompanham.

Paciência, segurança e respeito aos sinais de fome e saciedade ajudam a construir uma relação positiva com a alimentação.`,
  sleep: `O sono do bebê muda bastante ao longo dos primeiros meses. Uma rotina previsível pode ajudar a criança a reconhecer os momentos de descanso.

Luz mais baixa, redução de estímulos e horários relativamente consistentes são medidas simples. A segurança do ambiente de sono deve ser sempre prioridade.

Em caso de dúvidas ou alterações persistentes, converse com o pediatra para receber orientações adequadas à idade.`,
  warning: `Durante a gestação, algumas mudanças precisam de avaliação profissional rápida.

Sangramento, perda de líquido, dor intensa, febre, falta de ar importante e redução percebida dos movimentos do bebê são exemplos de situações que merecem orientação imediata.

Esta matéria é informativa e não substitui atendimento médico. Diante de sintomas preocupantes, procure o serviço de saúde.`,
}

export const demoArticles: PortalArticle[] = [
  ['pre-natal-consultas-essenciais', 'Pré-natal: por que cada consulta é essencial para a saúde da mãe e do bebê', 'Acompanhamento regular reduz riscos e oferece mais segurança durante toda a gestação.', 'Gestação', demoContent.prenatal],
  ['amamentacao-sem-dor', 'Amamentação sem dor: orientações para tornar esse momento mais leve', 'Apoio especializado e pequenos ajustes podem transformar a experiência de amamentar.', 'Amamentação', demoContent.breastfeeding],
  ['marcos-desenvolvimento-infantil', 'Marcos do desenvolvimento infantil: o que observar nos primeiros meses', 'Entenda como acompanhar as conquistas da criança sem comparações rígidas.', 'Desenvolvimento', demoContent.development],
  ['vacinas-em-dia', 'Vacinas em dia: proteção que acompanha cada fase do crescimento', 'A caderneta atualizada protege a criança e também toda a comunidade.', 'Saúde infantil', demoContent.vaccines],
  ['licenca-maternidade-direitos', 'Licença-maternidade: conheça os principais direitos', 'Informação e planejamento ajudam a família a atravessar essa fase com mais tranquilidade.', 'Família', demoContent.leave],
  ['introducao-alimentar', 'Introdução alimentar: quando começar e como tornar a fase mais tranquila', 'Novos sabores e texturas devem ser apresentados com segurança e respeito ao ritmo da criança.', 'Bebê', demoContent.feeding],
  ['sono-do-bebe', 'Sono do bebê: como construir uma rotina saudável e segura', 'Hábitos simples podem tornar o momento de descanso mais previsível para toda a família.', 'Bem-estar', demoContent.sleep],
  ['sinais-alerta-gestacao', 'Sinais de alerta na gestação que merecem atenção', 'Saiba reconhecer situações em que é importante procurar orientação profissional rapidamente.', 'Gestação', demoContent.warning],
].map(([slug, title, excerpt, category, content], index) => ({
  id: `demo-${index + 1}`, slug, title, excerpt, category, content,
  coverImageUrl: null, authorName: 'Equipe MaterPlace', status: 'published' as const,
  featured: index === 0, publishedAt: new Date(2026, 7, 10 - index).toISOString(),
  createdAt: new Date(2026, 7, 10 - index).toISOString(), isDemo: true, views: 30 - index * 2,
}))

function mapRow(row: Record<string, unknown>): PortalArticle {
  return {
    id: String(row.id), slug: String(row.slug), title: String(row.title), excerpt: String(row.excerpt || ''),
    content: String(row.content || ''), category: String(row.category || 'MaterPlace'),
    coverImageUrl: row.cover_image_url ? String(row.cover_image_url) : null,
    authorName: String(row.author_name || 'Equipe MaterPlace'), status: row.status as NewsStatus,
    featured: Boolean(row.featured), publishedAt: row.published_at ? String(row.published_at) : null,
    createdAt: String(row.created_at), isDemo: Boolean(row.is_demo), views: Number(row.views || 0),
  }
}

export async function listPortalArticles(limit = 12): Promise<PortalArticle[]> {
  const hidden=JSON.parse(localStorage.getItem('materplace-hidden-demo-news')||'[]') as string[]
  if (!isSupabaseConfigured || !supabase) return demoArticles.filter(x=>!hidden.includes(x.id)).slice(0, limit)
  const { data, error } = await supabase.from('news_articles').select('*').eq('status', 'published').order('featured', { ascending: false }).order('published_at', { ascending: false }).limit(limit)
  if (error) throw error
  if (!data?.length) return []
  return data.map(mapRow)
}

export async function getPortalArticle(slug: string): Promise<PortalArticle> {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase.from('news_articles').select('*').eq('slug', slug).eq('status', 'published').maybeSingle()
    if (data) {
      void supabase.rpc('register_news_view', { article_slug: slug })
      return mapRow(data)
    }
  }
  throw new Error('Notícia não encontrada.')
}

export async function adminListArticles(): Promise<PortalArticle[]> {
  const hidden=JSON.parse(localStorage.getItem('materplace-hidden-demo-news')||'[]') as string[]
  if (!supabase) return demoArticles.filter(x=>!hidden.includes(x.id))
  const { data, error } = await supabase.from('news_articles').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapRow)
}

export async function saveArticle(input: NewsInput): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado.')
  const payload = {
    slug: input.slug, title: input.title, excerpt: input.excerpt, content: input.content,
    category: input.category, cover_image_url: input.coverImageUrl || null, author_name: input.authorName,
    status: input.status, featured: input.featured,
    published_at: input.status === 'published' ? new Date().toISOString() : null,
  }
  const result = input.id ? await supabase.from('news_articles').update(payload).eq('id', input.id) : await supabase.from('news_articles').insert(payload)
  if (result.error) throw result.error
}

export async function removeArticle(id: string): Promise<void> {
  if(id.startsWith('demo-')) { const hidden=JSON.parse(localStorage.getItem('materplace-hidden-demo-news')||'[]') as string[]; localStorage.setItem('materplace-hidden-demo-news',JSON.stringify([...new Set([...hidden,id])])); return }
  if (!supabase) throw new Error('Supabase não configurado.')
  const { error } = await supabase.from('news_articles').delete().eq('id', id)
  if (error) throw error
}

export function youtubeIdFrom(value:string) {
  const match=value.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/) || value.match(/^([A-Za-z0-9_-]{11})$/)
  return match?.[1] || ''
}

export async function uploadNewsImage(file:File):Promise<string> {
  if(!supabase) throw new Error('Supabase não configurado.')
  if(!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.')
  if(file.size>5*1024*1024) throw new Error('A imagem deve ter no máximo 5 MB.')
  const extension=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')
  const path=`${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.${extension}`
  const {error}=await supabase.storage.from('news-media').upload(path,file,{contentType:file.type,upsert:false})
  if(error) throw error
  return supabase.storage.from('news-media').getPublicUrl(path).data.publicUrl
}

export async function listPortalVideos(admin=false):Promise<PortalVideo[]> {
  if(!supabase) return []
  let query=supabase.from('portal_videos').select('*').order('featured',{ascending:false}).order('created_at',{ascending:false})
  if(!admin) query=query.eq('published',true)
  const {data,error}=await query
  if(error) return []
  return (data||[]).map(row=>({id:String(row.id),title:String(row.title),description:String(row.description||''),youtubeId:String(row.youtube_id),published:Boolean(row.published),featured:Boolean(row.featured),createdAt:String(row.created_at)}))
}

export async function savePortalVideo(input:{id?:string;title:string;description:string;youtubeUrl:string;published:boolean;featured:boolean}) {
  if(!supabase) throw new Error('Supabase não configurado.')
  const youtubeId=youtubeIdFrom(input.youtubeUrl)
  if(!youtubeId) throw new Error('Informe um link ou código de incorporação válido do YouTube.')
  const payload={title:input.title,description:input.description,youtube_id:youtubeId,published:input.published,featured:input.featured}
  const result=input.id?await supabase.from('portal_videos').update(payload).eq('id',input.id):await supabase.from('portal_videos').insert(payload)
  if(result.error) throw result.error
}

export async function removePortalVideo(id:string) { if(!supabase) return; const {error}=await supabase.from('portal_videos').delete().eq('id',id); if(error) throw error }
