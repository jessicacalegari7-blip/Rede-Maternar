import {ArrowRight, Check, CirclePlay, ExternalLink, Image, Instagram, Link2, MapPin, MessageCircle, ShieldCheck, Sparkles, Tag} from 'lucide-react'
import {Link} from 'react-router-dom'
import {Logo} from '../../components/Logo'
import {Seo} from '../../components/Seo'
import {LegalFooter} from './Legal'

const checkout='/cadastro-profissional?plano=marketplace'
const benefits=[
  [Link2,'Seu endereço profissional','Uma URL personalizada e estável dentro da MaterPlace para compartilhar em seus canais.'],
  [Image,'Galeria profissional','Fotos otimizadas da clínica, consultório, equipe e ambientes de atendimento.'],
  [CirclePlay,'Vídeos por link','Inclua até três vídeos do YouTube sem consumir o armazenamento do seu perfil.'],
  [MapPin,'Múltiplos locais','Apresente clínicas, consultórios e unidades com endereço completo.'],
  [Instagram,'Instagram integrado','Leve visitantes diretamente ao seu perfil profissional oficial.'],
  [Tag,'Serviços e preços','Organize seus atendimentos, modalidades, duração e valores em cards claros.'],
  [MessageCircle,'WhatsApp direto','Facilite o primeiro contato com uma mensagem inicial pronta.'],
  [Sparkles,'Diretório especializado','Apareça no ecossistema materno-infantil quando o perfil estiver completo e elegível.'],
] as const
const faq=[
  ['O que é o MaterPlace Premium?','É uma página profissional completa dentro do ecossistema MaterPlace, com URL personalizada, mídia, serviços, contatos e presença no diretório.'],
  ['Quanto custa?','R$ 99,90 por 12 meses, em pagamento único.'],
  ['A cobrança é mensal?','Não. O pagamento é anual, sem mensalidades e sem renovação automática.'],
  ['Quando recebo meu acesso?','Após a confirmação do pagamento pelo Asaas, enviamos automaticamente um convite seguro para criar sua senha.'],
  ['Como publico meu perfil?','Preencha nome, telefone, ao menos uma especialidade e um local de atendimento. Com contrato ativo e dados válidos, a publicação é automática.'],
  ['Preciso aguardar aprovação manual?','Não. A publicação ocorre automaticamente quando os requisitos obrigatórios são atendidos, sem eliminar os controles de segurança e moderação.'],
  ['Posso cadastrar várias clínicas?','Sim. Você pode incluir múltiplos locais de atendimento; controles técnicos protegem a plataforma contra abuso.'],
  ['Posso incluir fotos e vídeos?','Sim. O perfil aceita galeria de fotos e até três vídeos por links do YouTube.'],
  ['Posso mostrar serviços e preços?','Sim. Serviços publicados podem apresentar descrição, duração, modalidade e preço.'],
  ['Posso colocar Instagram e WhatsApp?','Sim. Os links são exibidos como ações diretas no perfil público.'],
  ['Posso compartilhar meu endereço personalizado?','Sim. O painel fornece o link público para copiar e compartilhar.'],
  ['O que acontece ao final do período?','Sem um novo período ativo, o Premium deixa de ser elegível para publicação. Não há renovação automática.'],
  ['Posso atualizar o perfil depois?','Sim. Informações, mídia, endereços, serviços e contatos permanecem editáveis no painel.'],
  ['E se o pagamento não for confirmado?','O acesso Premium não é ativado. A página de status informa que a confirmação depende do webhook financeiro do Asaas.'],
] as const

function Buy({label='QUERO MEU PERFIL PREMIUM',className=''}:{label?:string;className?:string}){return <Link className={`btn premium-buy ${className}`} to={checkout}>{label}<ArrowRight size={18}/></Link>}

export function PremiumLanding(){return <div className="premium-landing">
  <Seo title="MaterPlace Premium — sua página profissional" description="Crie seu espaço profissional no universo materno-infantil por R$ 99,90 ao ano, com página personalizada, serviços, fotos, vídeos e contato direto." path="/premium" schema={{'@context':'https://schema.org','@type':'Product',name:'MaterPlace Premium',description:'Página profissional na MaterPlace por 12 meses, sem renovação automática.',offers:{'@type':'Offer',price:'99.90',priceCurrency:'BRL',availability:'https://schema.org/InStock'}}}/>
  <header className="premium-header"><Link to="/"><Logo/></Link><nav><a href="#beneficios">Benefícios</a><a href="#como-funciona">Como funciona</a><a href="#faq">Dúvidas</a></nav><div><Link className="btn btn-secondary" to="/login">FAZER LOGIN</Link><Buy label="CONTRATAR"/></div></header>
  <main>
    <section className="premium-hero"><div className="premium-hero-copy"><span>CONECTA • ACOLHE • TRANSFORMA</span><h1>Sua profissão merece mais do que um perfil. <em>Merece um espaço só seu.</em></h1><p>Transforme sua presença digital com uma página profissional completa na MaterPlace. Apresente seu trabalho e facilite o encontro com famílias do universo materno-infantil.</p><div className="premium-price"><strong>R$ 99,90</strong><span>/ ano<small>Pagamento único. Sem renovação automática.</small></span></div><div className="premium-actions"><Buy/><a className="btn btn-secondary" href="#beneficios">CONHECER OS BENEFÍCIOS</a></div><small className="premium-safe"><ShieldCheck/> Checkout Asaas com Pix ou cartão</small></div>
      <div className="premium-profile-demo" aria-label="Demonstração de perfil profissional"><div className="demo-cover"><span>materplace.com.br/seunome</span></div><div className="demo-person"><div className="demo-avatar">MP</div><div><small>PERFIL PREMIUM</small><h2>Marina Profissional</h2><p>Especialista materno-infantil</p></div></div><p>Um espaço para apresentar sua abordagem, serviços e locais de atendimento.</p><div className="demo-gallery"><i/><i/><i/></div><div className="demo-tags"><span>Consulta inicial</span><span>Atendimento online</span></div><button>Falar no WhatsApp</button></div>
    </section>

    <section className="premium-section" id="beneficios"><div className="premium-heading"><span>SEU ESPAÇO PROFISSIONAL</span><h2>Tudo o que você precisa para apresentar seu trabalho com clareza.</h2><p>Recursos reais, editáveis e organizados em uma experiência feita para profissionais do cuidado.</p></div><div className="premium-benefit-grid">{benefits.map(([Icon,title,description])=><article key={title}><Icon/><h3>{title}</h3><p>{description}</p></article>)}</div><Buy label="QUERO UMA PÁGINA ASSIM" className="premium-centered"/></section>

    <section className="premium-showcase"><div><span>SEU PERFIL NA PRÁTICA</span><h2>Bonito no desktop. Direto ao ponto no celular.</h2><p>Nome, especialidades, apresentação, galeria, vídeos, serviços, unidades, Instagram e WhatsApp em um único endereço.</p><ul>{['URL personalizada dentro da MaterPlace','Informações atualizadas por você','Publicação automática quando elegível','Contato rápido para visitantes'].map(item=><li key={item}><Check/>{item}</li>)}</ul><Buy label="CONTRATAR MEU PERFIL"/></div><div className="premium-device"><div className="device-screen"><span>Perfil Premium</span><div className="device-avatar"/><h3>Seu nome profissional</h3><p>Especialidade • Cidade</p><div className="device-buttons"><b>WhatsApp</b><b>Instagram</b></div><div className="device-cards"><i/><i/><i/><i/></div></div></div></section>

    <section className="premium-section" id="como-funciona"><div className="premium-heading"><span>SIMPLES DO INÍCIO AO LINK</span><h2>Como funciona</h2></div><div className="premium-steps">{[['01','Contrate seu Premium','Escolha Pix ou cartão e realize o pagamento único de R$ 99,90.'],['02','Receba seu acesso','Após a confirmação, receba o convite para criar sua senha.'],['03','Personalize seu espaço','Cadastre informações, serviços, fotos, vídeos, locais e contatos.'],['04','Comece a divulgar','Com o perfil completo e elegível, a publicação é automática.']].map(([number,title,text])=><article key={number}><strong>{number}</strong><h3>{title}</h3><p>{text}</p></article>)}</div><p className="premium-callout">Sem burocracia. Sem aprovação manual. A publicação depende apenas dos dados obrigatórios e da vigência do Premium.</p><Buy label="COMEÇAR AGORA" className="premium-centered"/></section>

    <section className="premium-pricing"><span>SUA PRESENÇA PROFISSIONAL COMEÇA AQUI</span><h2>MaterPlace Premium</h2><div className="premium-price"><strong>R$ 99,90</strong><span>/ ano</span></div><p>Um pagamento. Um ano de presença profissional na MaterPlace.</p><div>{['Página e link personalizados','Fotos e vídeos','Múltiplos locais','Serviços e preços','Instagram e WhatsApp','Presença no diretório'].map(item=><span key={item}><Check/>{item}</span>)}</div><Buy label="CONTRATAR MEU PERFIL PREMIUM"/><small>Pix ou cartão • pagamento único • sem mensalidades • sem renovação automática</small></section>

    <section className="premium-section premium-faq" id="faq"><div className="premium-heading"><span>PERGUNTAS FREQUENTES</span><h2>Informação clara antes da contratação.</h2></div>{faq.map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</section>
    <section className="premium-final"><div><span>CONECTA • ACOLHE • TRANSFORMA</span><h2>Seu trabalho merece um espaço à altura.</h2><p>Mais visibilidade, mais conexões e mais oportunidades para apresentar o seu trabalho.</p></div><Buy label="QUERO MEU PERFIL PREMIUM"/></section>
  </main>
  <LegalFooter/>
  <div className="premium-mobile-cta"><strong>R$ 99,90/ano</strong><Buy label="CONTRATAR"/></div>
</div>}
