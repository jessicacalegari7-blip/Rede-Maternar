import { CalendarDays, CheckCircle2, CircleDollarSign, CreditCard, Receipt, Wallet } from 'lucide-react'

const appointments = [
  ['29/07 · 08:00','Camila Ribeiro','Consulta inicial','R$ 220,00','R$ 6,60','R$ 22,00','R$ 191,40','Pix'],
  ['29/07 · 10:30','Juliana Martins','Retorno gratuito','R$ 0,00','R$ 0,00','R$ 0,00','R$ 0,00','Gratuito'],
  ['28/07 · 14:00','Beatriz Lopes','Teleconsulta','R$ 250,00','R$ 9,75','R$ 25,00','R$ 215,25','Crédito'],
  ['27/07 · 18:00','Mariana Alves','Retorno pago','R$ 150,00','R$ 1,49','R$ 15,00','R$ 133,51','Pix'],
]

export function MyProduction() {
  return <div>
    <div className="page-heading"><div><span className="badge">Área individual</span><h1>Meus atendimentos e repasses</h1><p className="muted">Acompanhe apenas sua agenda, sua produção e a composição dos valores de cada consulta.</p></div><button className="btn btn-secondary"><Receipt size={17}/> Exportar extrato</button></div>
    <div className="grid grid-4">
      <div className="card team-metric"><CalendarDays/><span><strong>18</strong><small>Atendimentos no mês</small></span></div>
      <div className="card team-metric"><CircleDollarSign/><span><strong>R$ 4.320</strong><small>Valor das consultas</small></span></div>
      <div className="card team-metric"><CreditCard/><span><strong>R$ 286,40</strong><small>Taxas e retenções</small></span></div>
      <div className="card team-metric"><Wallet/><span><strong>R$ 4.033,60</strong><small>Repasse líquido previsto</small></span></div>
    </div>
    <section className="card backoffice-table-card clinic-team-card">
      <div className="section-heading"><div><h2>Composição por atendimento</h2><p className="muted">Valores transparentes, separados por meio de pagamento, taxa operacional da clínica e repasse líquido.</p></div><span className="badge">Somente seus dados</span></div>
      <div className="table-wrap"><table><thead><tr><th>Data e paciente</th><th>Serviço</th><th>Valor</th><th>Meio/taxa</th><th>Taxa da clínica</th><th>Repasse líquido</th><th>Status</th></tr></thead><tbody>
        {appointments.map(([date,patient,service,total,paymentFee,clinicFee,net,method])=><tr key={`${date}-${patient}`}><td><strong>{patient}</strong><small className="table-subtitle">{date}</small></td><td>{service}</td><td>{total}</td><td><strong>{method}</strong><small className="table-subtitle">{paymentFee}</small></td><td>{clinicFee}</td><td><strong>{net}</strong></td><td><span className="badge"><CheckCircle2 size={14}/> Processado</span></td></tr>)}
      </tbody></table></div>
    </section>
    <section className="card production-notice"><strong>Privacidade financeira</strong><p className="muted">A profissional visualiza seus próprios atendimentos e repasses. A clínica mantém a visão consolidada conforme as permissões administrativas.</p></section>
  </div>
}
