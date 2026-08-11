import { ExternalLink, Newspaper } from 'lucide-react'

const wordpressAdminUrl = import.meta.env.VITE_WORDPRESS_ADMIN_URL?.trim()

export function AdminNewsPortal() {
  return <div>
    <div className="page-heading">
      <div>
        <h1>Notícias do portal</h1>
        <p className="muted">Publique e gerencie os conteúdos exibidos no portal da MaterPlace.</p>
      </div>
    </div>
    <section className="card empty-state">
      <Newspaper size={46} />
      <h2>Central de conteúdo WordPress</h2>
      {wordpressAdminUrl ? <>
        <p className="muted">O acesso é exclusivo da administração geral.</p>
        <a className="btn btn-primary" href={wordpressAdminUrl} target="_blank" rel="noreferrer">
          Abrir WordPress <ExternalLink size={17} />
        </a>
      </> : <>
        <p className="muted">A área está preparada. O botão será liberado assim que o endereço do WordPress e o login único forem configurados.</p>
        <div className="alert">Integração WordPress aguardando configuração.</div>
      </>}
    </section>
  </div>
}
