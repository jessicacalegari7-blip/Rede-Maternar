from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import StrEnum
from hashlib import sha256
from typing import Any

class ClaimStatus(StrEnum):
    SUPPORTED="SUPPORTED"; PARTIALLY_SUPPORTED="PARTIALLY_SUPPORTED"
    UNSUPPORTED="UNSUPPORTED"; CONFLICTING_SOURCES="CONFLICTING_SOURCES"

@dataclass
class Source:
    url: str; publisher: str; publication_date: str; source_type: str; trust_level: int

@dataclass
class Topic:
    title: str; why_now: str; scores: dict[str,float]
    discovered_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    @property
    def topic_hash(self)->str: return sha256(self.title.strip().lower().encode()).hexdigest()
    @property
    def editorial_score(self)->float:
        return max(0.0,min(100.0,sum(v for k,v in self.scores.items() if k!="duplicate_penalty")-self.scores.get("duplicate_penalty",0)))

@dataclass
class ResearchDossier:
    topic: Topic; main_fact: str; chronology: list[str]; facts: list[str]; recommendations: list[str]
    controversies: list[str]; sources: list[Source]; experts: list[dict[str,str]]; confidence: float

@dataclass
class FactCheckItem:
    claim: str; status: ClaimStatus; source_urls: list[str]

@dataclass
class ArticleDraft:
    title: str; subtitle: str; slug: str; excerpt: str; content_html: str; category: str
    tags: list[str]; seo_title: str; meta_description: str; primary_keyword: str
    secondary_keywords: list[str]; long_tail_keywords: list[str]; source_urls: list[str]
    featured_image: str|None=None; featured_image_alt: str=""; status: str="draft"
    technical_review_pending: bool=True; generated_by_ai: bool=True
    def cms_payload(self)->dict[str,Any]:
        if self.status!="draft": raise ValueError("O robô só pode enviar rascunhos")
        return {**asdict(self),"content":self.content_html,"cover_image_url":self.featured_image,
                "author_name":"Redação MaterPlace — revisão humana pendente","featured":False,"published_at":None}

@dataclass
class PipelineResult:
    topic: Topic; dossier: ResearchDossier; article: ArticleDraft
    fact_check: list[FactCheckItem]; warnings: list[str]; quality_gate: str
