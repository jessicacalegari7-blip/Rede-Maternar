import json
from urllib.request import Request, urlopen
from .models import ArticleDraft

class MaterPlaceCMSClient:
    """Cliente do PostgREST real usado pelo painel MaterPlace."""
    def __init__(self,url:str,key:str,sender=None):self.url=url.rstrip('/');self.key=key;self.sender=sender or self._send
    @staticmethod
    def _send(url,headers,payload):
        request=Request(url,data=json.dumps(payload).encode(),headers={**headers,"Content-Type":"application/json"},method="POST")
        with urlopen(request,timeout=20) as response:return json.loads(response.read())
    def create_draft(self,article:ArticleDraft)->dict:
        if article.status!="draft":raise ValueError("Publicação automática proibida")
        if not self.url or not self.key:raise RuntimeError("Credenciais Supabase ausentes")
        payload=article.cms_payload(); allowed={"slug","title","seo_title","excerpt","content","category","cover_image_url","author_name","status","featured","published_at"}
        result=self.sender(f"{self.url}/rest/v1/news_articles",{"apikey":self.key,"Authorization":f"Bearer {self.key}","Prefer":"return=representation"},{k:v for k,v in payload.items() if k in allowed})
        return result[0]
