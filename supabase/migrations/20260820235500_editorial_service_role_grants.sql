grant usage on schema public to service_role;

grant select, insert, update, delete
on table public.editorial_topics,
         public.editorial_sources,
         public.editorial_runs,
         public.editorial_article_audits,
         public.editorial_feedback,
         public.news_articles
to service_role;

