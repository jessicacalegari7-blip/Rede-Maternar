import { FormEvent, useEffect, useState } from 'react'
import { Archive, ImagePlus, RefreshCw } from 'lucide-react'
import { listManagedEcosystem, saveEcosystem, updateEcosystemStatus, uploadEcosystemImage, type EcosystemKind, type EcosystemRow } from '../../lib/ecosystem'

const copy: Record<EcosystemKind, { title: string; singular: string }> = { marketplace: { title: 'Meus produtos', singular: 'produto' }, courses: { title: 'Meus cursos', singular: 'curso' }, jobs: { title: 'Minhas vagas', singular: 'vaga' } }

export function EcosystemManager({ kind }: { kind: EcosystemKind }) {
  const [rows, setRows] = useState<EcosystemRow[]>([]), [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [error, setError] = useState('')
  const labels = copy[kind]
  async function load() { try { setRows(await listManagedEcosystem(kind, true)); setError('') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar seus conteúdos.') } }
  useEffect(() => { void load() }, [kind])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      const form = event.currentTarget, fields = new FormData(form), file = fields.get('image') as File
      const image_url = file?.size ? await uploadEcosystemImage(file, kind) : undefined
      const common = { description: String(fields.get('description') || '').trim(), image_url }, price_cents = Math.round(Number(fields.get('price') || 0) * 100)
      const payload = kind === 'marketplace' ? { ...common, name: String(fields.get('name')), category: String(fields.get('category')), price_cents, item_condition: String(fields.get('item_condition')), city: String(fields.get('city')), state_code: String(fields.get('state_code')).toUpperCase(), contact_url: String(fields.get('contact_url')) }
        : kind === 'courses' ? { ...common, name: String(fields.get('name')), category: String(fields.get('category')), audience: String(fields.get('audience')), price_cents, instructor_name: String(fields.get('instructor_name')), contact_url: String(fields.get('contact_url')) }
        : { ...common, title: String(fields.get('name')), company_name: String(fields.get('company_name')), city: String(fields.get('city')), state_code: String(fields.get('state_code')).toUpperCase(), workplace_type: String(fields.get('workplace_type')), employment_type: String(fields.get('employment_type')), requirements: String(fields.get('requirements') || '') || null, benefits: String(fields.get('benefits') || '') || null, application_url: String(fields.get('contact_url')) }
      await saveEcosystem(kind, payload); form.reset(); setNotice(`${labels.singular[0].toUpperCase() + labels.singular.slice(1)} enviado para análise.`); await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível enviar.') } finally { setBusy(false) }
  }
  async function archive(id: string) { setBusy(true); try { await updateEcosystemStatus(kind, id, 'archived'); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao arquivar.') } finally { setBusy(false) } }

  return <>
    <div className="page-heading"><div><span className="badge">Publicação</span><h1>{labels.title}</h1><p className="muted">Os conteúdos enviados passam por revisão antes de aparecerem no portal.</p></div><button className="btn btn-secondary" onClick={() => void load()}><RefreshCw />Atualizar</button></div>
    {error && <div className="alert alert-error">{error}</div>}{notice && <div className="alert alert-success">{notice}</div>}
    <form className="card form-grid ecosystem-submission-form" onSubmit={submit}>
      <h2 className="field-span-2">Cadastrar {labels.singular}</h2><label className="field"><span>{kind === 'jobs' ? 'Cargo' : 'Nome'}</span><input name="name" required minLength={3} /></label>
      {kind === 'jobs' && <label className="field"><span>Clínica ou empresa</span><input name="company_name" required /></label>}{kind !== 'jobs' && <label className="field"><span>Categoria</span><input name="category" required /></label>}
      {kind === 'courses' && <><label className="field"><span>Instrutor</span><input name="instructor_name" required /></label><label className="field"><span>Público</span><select name="audience"><option value="families">Famílias</option><option value="professionals">Profissionais</option></select></label></>}
      {kind === 'marketplace' && <label className="field"><span>Condição</span><select name="item_condition"><option value="new">Novo</option><option value="used">Usado</option></select></label>}{kind !== 'jobs' && <label className="field"><span>Preço em reais</span><input name="price" type="number" min="0" step="0.01" required /></label>}
      {kind !== 'courses' && <><label className="field"><span>Cidade</span><input name="city" required /></label><label className="field"><span>UF</span><input name="state_code" required minLength={2} maxLength={2} /></label></>}
      {kind === 'jobs' && <><label className="field"><span>Modelo</span><select name="workplace_type"><option value="onsite">Presencial</option><option value="hybrid">Híbrido</option><option value="remote">Remoto</option></select></label><label className="field"><span>Contratação</span><select name="employment_type"><option value="clt">CLT</option><option value="pj">PJ</option><option value="self_employed">Autônomo</option><option value="internship">Estágio</option><option value="temporary">Temporário</option><option value="other">Outro</option></select></label><label className="field field-span-2"><span>Requisitos</span><textarea name="requirements" rows={3} /></label><label className="field field-span-2"><span>Benefícios</span><textarea name="benefits" rows={3} /></label></>}
      <label className="field field-span-2"><span>Descrição</span><textarea name="description" required minLength={20} rows={5} /></label>{kind !== 'jobs' && <label className="field"><span><ImagePlus /> Imagem</span><input name="image" type="file" accept="image/jpeg,image/png,image/webp" /></label>}
      <label className="field"><span>{kind === 'jobs' ? 'Link ou e-mail para candidatura' : 'Link ou contato'}</span><input name="contact_url" required placeholder="https://... ou mailto:..." /></label><button className="btn btn-primary field-span-2" disabled={busy}>{busy ? 'Salvando...' : 'Enviar para aprovação'}</button>
    </form>
    <section className="card ecosystem-admin-list"><h2>Conteúdos enviados</h2>{rows.map(row => <article key={row.id}><div><small>{row.status}</small><h3>{row.name || row.title}</h3><p>{row.description}</p></div>{row.status !== 'archived' && <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={() => void archive(row.id)}><Archive />Arquivar</button>}</article>)}{!rows.length && <p className="muted">Nenhum conteúdo enviado.</p>}</section>
  </>
}
