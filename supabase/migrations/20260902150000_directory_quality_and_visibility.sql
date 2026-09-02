-- Remove da publicação estabelecimentos comerciais incompatíveis com saúde.
update public.clinic_prospects set review_status='rejected',publication_status='unpublished',updated_at=now()
where review_status='approved' and (
  lower(name) ~ '\\m(bar|boteco|pub|restaurante|pizzaria|lanchonete|churrascaria|cervejaria|adega|hotel|motel|mercado|supermercado)\\M'
  or lower(coalesce(source_payload->>'primary_type','')) in ('bar','restaurant','cafe','night_club','liquor_store','lodging','store','shopping_mall','supermarket')
);

create index if not exists clinic_prospects_directory_lookup_idx on public.clinic_prospects(specialty_slug,city_slug,review_status,publication_status);
