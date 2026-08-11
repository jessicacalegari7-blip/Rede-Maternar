export function Placeholder({title,description}:{title:string;description:string}) {
  return <><div className="topbar"><div><h1>{title}</h1><div className="muted">{description}</div></div></div><div className="card empty-state"><span className="badge">Integração pendente</span><h2>Nenhum dado fictício é exibido</h2><p className="muted">Este recurso será liberado somente depois que a integração real estiver configurada e validada.</p></div></>
}
