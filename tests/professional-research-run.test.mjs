import { describe, expect, it } from 'vitest'
import { mapOsmItem, normalizeBrazilPhone, slugify } from '../api/professional-research-run.mjs'

describe('professional research helpers', () => {
  it('normaliza slugs e telefones brasileiros', () => {
    expect(slugify('Consultoria de Amamentação')).toBe('consultoria-de-amamentacao')
    expect(normalizeBrazilPhone('(19) 99999-9999')).toBe('5519999999999')
    expect(normalizeBrazilPhone('telefone inválido')).toBeNull()
  })
  it('mapeia registro público sem endereço completo', () => {
    const row = mapOsmItem({type:'node',id:42,tags:{name:'Clínica Teste','addr:suburb':'Cambuí','addr:street':'Rua privada',phone:'19999999999'}},{city:'Campinas',city_slug:'campinas',state_code:'SP',specialty:'Pediatria',specialty_slug:'pediatria'})
    expect(row.neighborhood).toBe('Cambuí')
    expect(row.source_payload.tags['addr:street']).toBeUndefined()
    expect(row).not.toHaveProperty('address')
    expect(row.whatsapp).toBe('5519999999999')
  })
})
