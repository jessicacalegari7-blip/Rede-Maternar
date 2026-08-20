import json
from dataclasses import asdict
from .pipeline import EditorialPipeline

def main():
    result=EditorialPipeline().run()
    print(json.dumps(asdict(result) if result else {"status":"no_suitable_topic"},ensure_ascii=False,indent=2,default=str))
if __name__=="__main__":main()
