import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const migrationPath=new URL('../supabase/migrations/20261111100000_premium_public_profile_slugs.sql',import.meta.url)
const migration=await readFile(migrationPath,'utf8')

test('public slugs are normalized, unique and backfilled without changing later',()=>{
  assert.match(migration,/normalize_professional_public_slug/)
  assert.match(migration,/translate\(lower\(display_name\)/)
  assert.match(migration,/professional_profiles_public_slug_uidx/)
  assert.match(migration,/pg_advisory_xact_lock/)
  assert.match(migration,/where public_slug is null/)
  assert.match(migration,/if existing_slug is not null then return existing_slug/)
  assert.match(migration,/for profile_id in select id from public\.professional_profiles/)
})

test('slug history is private and reserved routes cannot be claimed',()=>{
  assert.match(migration,/professional_profile_slug_history enable row level security/)
  assert.match(migration,/revoke all on public\.professional_profile_slug_history from anon, authenticated, public/)
  for(const reserved of ['admin','api','login','noticias','profissionais','termos'])assert.match(migration,new RegExp(`'${reserved}'`))
})

test('public view only returns automatically published profiles and exposes slug',()=>{
  assert.match(migration,/pp\.public_slug/)
  assert.match(migration,/where pp\.marketplace_visible and o\.status='active'/)
  assert.doesNotMatch(migration,/grant (insert|update|delete|all).*anon/i)
})

test('legacy public profile links use a permanent redirect',async()=>{
  const source=await readFile(new URL('../api/directory-share.mjs',import.meta.url),'utf8')
  assert.match(source,/response\.redirect\(301/)
  assert.match(source,/marketplace_professionals/)
  assert.doesNotMatch(source,/professional_profiles'\)\.select\('\*'/)
})
