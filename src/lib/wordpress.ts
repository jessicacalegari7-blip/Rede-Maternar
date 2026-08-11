const WORDPRESS_API='https://public-api.wordpress.com/wp/v2/sites/materplaceportal.wordpress.com'

type WordPressPost={id:number;date:string;link:string;title:{rendered:string};excerpt:{rendered:string};content:{rendered:string};_embedded?:Record<string,any[]>}
export interface PortalArticle {id:number;title:string;excerpt:string;content:string;date:string;url:string;image:string|null;category:string}

function text(html:string){const document=new DOMParser().parseFromString(html,'text/html');return document.body.textContent?.trim()||''}

export async function listPortalArticles(limit=10):Promise<PortalArticle[]> {
  const response=await fetch(`${WORDPRESS_API}/posts?per_page=${limit}&_embed=1`)
  if(!response.ok)throw new Error('Não foi possível carregar as notícias do WordPress.')
  const posts=await response.json() as WordPressPost[]
  return posts.map(post=>({
    id:post.id,title:text(post.title.rendered),excerpt:text(post.excerpt.rendered),content:post.content.rendered,
    date:post.date,url:post.link,
    image:post._embedded?.['wp:featuredmedia']?.[0]?.source_url||null,
    category:post._embedded?.['wp:term']?.[0]?.[0]?.name||'MaterPlace',
  }))
}

export async function getPortalArticle(id:string):Promise<PortalArticle> {
  const response=await fetch(`${WORDPRESS_API}/posts/${encodeURIComponent(id)}?_embed=1`)
  if(!response.ok)throw new Error('Não foi possível carregar esta notícia.')
  const post=await response.json() as WordPressPost
  return {
    id:post.id,title:text(post.title.rendered),excerpt:text(post.excerpt.rendered),content:post.content.rendered,
    date:post.date,url:post.link,
    image:post._embedded?.['wp:featuredmedia']?.[0]?.source_url||null,
    category:post._embedded?.['wp:term']?.[0]?.[0]?.name||'MaterPlace',
  }
}
