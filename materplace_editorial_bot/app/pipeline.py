import re, unicodedata
from .config import Settings
from .models import *

def slugify(value:str)->str:
    value=unicodedata.normalize("NFKD",value).encode("ascii","ignore").decode().lower()
    return re.sub(r"^-|-$","",re.sub(r"[^a-z0-9]+","-",value))

class MockSourceConnector:
    def discover(self)->list[Topic]:
        return [Topic("Vacinação contra o VSR em gestantes: o que as famílias precisam saber","Tema recente com impacto direto na proteção de bebês",{"trend":12,"freshness":10,"relevance":18,"search":12,"authority":12,"impact":12,"originality":8})]

class MockResearcher:
    def research(self,topic:Topic)->ResearchDossier:
        sources=[Source("https://www.gov.br/saude/","Ministério da Saúde","2026-08-20","primary",5),Source("https://www.who.int/","OMS","2026-08-19","primary",5),Source("https://www.sbp.com.br/","SBP","2026-08-18","technical",5)]
        return ResearchDossier(topic,"Autoridades atualizaram orientações sobre prevenção do VSR",["Publicação","Contextualização"],["O VSR pode causar infecções respiratórias"],["Buscar orientação pré-natal individualizada"],[],sources,[],0.9)

class MockWriter:
    def write(self,d:ResearchDossier)->ArticleDraft:
        title=d.topic.title
        content='<p>Novas orientações reforçam a importância da prevenção do vírus sincicial respiratório durante a gestação.</p><h2>O que mudou</h2><p>As famílias devem conversar com a equipe do pré-natal para compreender as recomendações.</p><h2>O que as famílias precisam saber</h2><p>Este conteúdo tem caráter informativo e não substitui avaliação individualizada por profissional de saúde.</p><h2>Fontes</h2><ul>'+''.join(f'<li><a href="{s.url}">{s.publisher}</a></li>' for s in d.sources)+'</ul>'
        return ArticleDraft(title,"Entenda o contexto e quais dúvidas levar ao pré-natal.",slugify(title),"Orientações sobre prevenção do VSR durante a gestação.",content,"Gestação",["VSR","gestação"],"VSR na gestação: prevenção e orientações","Entenda as recomendações sobre VSR na gestação e quais dúvidas esclarecer no pré-natal.","VSR na gestação",["vacinação VSR"],["vacina VSR para gestante"],[s.url for s in d.sources])

class FactChecker:
    def check(self,d:ResearchDossier,a:ArticleDraft)->list[FactCheckItem]:
        return [FactCheckItem(f,ClaimStatus.SUPPORTED,[s.url for s in d.sources]) for f in d.facts]

class QualityGate:
    def evaluate(self,d:ResearchDossier,a:ArticleDraft,checks:list[FactCheckItem])->tuple[str,list[str]]:
        warnings=[]
        if len(d.sources)<2:warnings.append("Fontes insuficientes")
        if not any(s.trust_level>=5 and s.source_type=="primary" for s in d.sources):warnings.append("Fonte primária ausente")
        if any(c.status in {ClaimStatus.UNSUPPORTED,ClaimStatus.CONFLICTING_SOURCES} for c in checks):warnings.append("Fact-check crítico pendente")
        if a.status!="draft":warnings.append("Status inseguro")
        return ("FAILED" if warnings else "PASS",warnings)

class EditorialPipeline:
    def __init__(self,settings:Settings|None=None):self.settings=settings or Settings()
    def run(self)->PipelineResult|None:
        self.settings.validate(); candidates=MockSourceConnector().discover()
        eligible=[t for t in candidates if t.editorial_score>=self.settings.min_editorial_score]
        if not eligible:return None
        topic=max(eligible,key=lambda t:t.editorial_score); dossier=MockResearcher().research(topic)
        article=MockWriter().write(dossier); checks=FactChecker().check(dossier,article)
        gate,warnings=QualityGate().evaluate(dossier,article,checks)
        return PipelineResult(topic,dossier,article,checks,warnings,gate)
