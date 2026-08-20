import unittest
from app.cms import MaterPlaceCMSClient
from app.pipeline import EditorialPipeline,slugify

class PipelineTests(unittest.TestCase):
    def test_slugify(self):self.assertEqual(slugify("Bronquiolite em bebês: sinais!"),"bronquiolite-em-bebes-sinais")
    def test_pipeline_passes_and_never_publishes(self):
        result=EditorialPipeline().run();self.assertEqual(result.quality_gate,"PASS");self.assertEqual(result.article.status,"draft")
    def test_cms_rejects_published(self):
        article=EditorialPipeline().run().article;article.status="published"
        with self.assertRaises(ValueError):MaterPlaceCMSClient("https://example.test","secret").create_draft(article)
    def test_cms_contract_sends_draft_only(self):
        article=EditorialPipeline().run().article
        def sender(url,headers,payload):
            self.assertEqual(payload["status"],"draft");self.assertNotIn("generated_by_ai",payload);return [{"id":"1","status":"draft"}]
        self.assertEqual(MaterPlaceCMSClient("https://example.test","secret",sender).create_draft(article)["status"],"draft")
if __name__=="__main__":unittest.main()
