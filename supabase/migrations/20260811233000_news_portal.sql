create table if not exists public.news_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null default '',
  content text not null default '',
  category text not null default 'MaterPlace',
  cover_image_url text,
  author_name text not null default 'Equipe MaterPlace',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  featured boolean not null default false,
  published_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false,
  views bigint not null default 0
);

alter table public.news_articles enable row level security;
drop policy if exists "published news public read" on public.news_articles;
create policy "published news public read" on public.news_articles for select to anon, authenticated using (status='published' or public.is_platform_admin());
drop policy if exists "news admin insert" on public.news_articles;
create policy "news admin insert" on public.news_articles for insert to authenticated with check (public.is_platform_admin());
drop policy if exists "news admin update" on public.news_articles;
create policy "news admin update" on public.news_articles for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists "news admin delete" on public.news_articles;
create policy "news admin delete" on public.news_articles for delete to authenticated using (public.is_platform_admin());

grant select on public.news_articles to anon, authenticated;
grant insert, update, delete on public.news_articles to authenticated;

create or replace function public.register_news_view(article_slug text) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.news_articles set views=views+1 where slug=article_slug and status='published';
end; $$;
grant execute on function public.register_news_view(text) to anon, authenticated;

insert into public.news_articles (slug,title,excerpt,content,category,author_name,status,featured,published_at,is_demo)
values
('pre-natal-consultas-essenciais','Pré-natal: por que cada consulta é essencial para a saúde da mãe e do bebê','Acompanhamento regular reduz riscos e oferece mais segurança durante toda a gestação.',E'O acompanhamento pré-natal é uma das principais formas de proteger a saúde da mãe e do bebê durante toda a gestação.\n\nAs consultas permitem acompanhar o desenvolvimento do bebê, identificar fatores de risco e orientar a família sobre alimentação, vacinas, exames e preparação para o parto.\n\nMesmo quando a gestação parece tranquila, manter o calendário de consultas é essencial. Cada encontro oferece uma oportunidade para esclarecer dúvidas e reconhecer mudanças que merecem atenção.','Gestação','Equipe MaterPlace','published',true,now(),true),
('amamentacao-sem-dor','Amamentação sem dor: orientações para tornar esse momento mais leve','Apoio especializado e pequenos ajustes podem transformar a experiência de amamentar.',E'Amamentar é um processo de aprendizado para a mãe e para o bebê. Desconfortos persistentes não devem ser considerados normais.\n\nBuscar apoio especializado logo nos primeiros sinais de dor pode prevenir fissuras e tornar a experiência mais tranquila.\n\nCada dupla tem seu próprio ritmo. Informação confiável, acolhimento e uma rede de apoio ajudam a construir uma jornada possível e respeitosa.','Amamentação','Equipe MaterPlace','published',false,now()-interval '1 day',true),
('marcos-desenvolvimento-infantil','Marcos do desenvolvimento infantil: o que observar nos primeiros meses','Entenda como acompanhar as conquistas da criança sem comparações rígidas.',E'O desenvolvimento infantil acontece de maneira contínua e cada criança possui seu próprio ritmo.\n\nNos primeiros meses, movimentos, interação com rostos, sons e tentativas de comunicação são sinais importantes.\n\nQuando houver preocupação, uma avaliação profissional é o caminho mais seguro para orientar os próximos passos.','Desenvolvimento','Equipe MaterPlace','published',false,now()-interval '2 days',true),
('vacinas-em-dia','Vacinas em dia: proteção que acompanha cada fase do crescimento','A caderneta atualizada protege a criança e também toda a comunidade.',E'Manter a vacinação em dia protege a criança e toda a comunidade contra doenças que podem causar complicações graves.\n\nA caderneta deve ser levada às consultas e às unidades de saúde para conferência.\n\nInformações sobre vacinas devem ser verificadas em fontes oficiais e com profissionais de saúde.','Saúde infantil','Equipe MaterPlace','published',false,now()-interval '3 days',true),
('licenca-maternidade-direitos','Licença-maternidade: conheça os principais direitos','Informação e planejamento ajudam a família a atravessar essa fase com mais tranquilidade.',E'Conhecer os direitos relacionados à licença-maternidade ajuda a família a se organizar para a chegada do bebê.\n\nAs regras podem variar conforme o vínculo de trabalho e a situação previdenciária. Por isso, consulte os canais oficiais.','Família','Equipe MaterPlace','published',false,now()-interval '4 days',true),
('introducao-alimentar','Introdução alimentar: quando começar e como tornar a fase mais tranquila','Novos sabores e texturas devem ser apresentados com segurança e respeito ao ritmo da criança.',E'A introdução alimentar é uma fase de descobertas que complementa o aleitamento e apresenta novos sabores, aromas e texturas.\n\nO momento adequado deve considerar o desenvolvimento da criança e a orientação dos profissionais que a acompanham.','Bebê','Equipe MaterPlace','published',false,now()-interval '5 days',true),
('sono-do-bebe','Sono do bebê: como construir uma rotina saudável e segura','Hábitos simples podem tornar o momento de descanso mais previsível para toda a família.',E'O sono do bebê muda bastante ao longo dos primeiros meses. Uma rotina previsível pode ajudar a criança a reconhecer os momentos de descanso.\n\nA segurança do ambiente de sono deve ser sempre prioridade.','Bem-estar','Equipe MaterPlace','published',false,now()-interval '6 days',true),
('sinais-alerta-gestacao','Sinais de alerta na gestação que merecem atenção','Saiba reconhecer situações em que é importante procurar orientação profissional rapidamente.',E'Durante a gestação, algumas mudanças precisam de avaliação profissional rápida.\n\nSangramento, perda de líquido, dor intensa, febre e falta de ar importante são exemplos de situações que merecem orientação imediata.\n\nEsta matéria é informativa e não substitui atendimento médico.','Gestação','Equipe MaterPlace','published',false,now()-interval '7 days',true)
on conflict (slug) do nothing;
