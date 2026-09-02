import { useEffect, useMemo, useState } from 'react'
import { maternalChildSpecialties } from '../data/specialties'
import { listActiveSpecialties } from '../lib/operations'

type City = { name: string; state: string; label: string; search: string }

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0]
    previous[0] = i
    for (let j = 1; j <= right.length; j += 1) {
      const above = previous[j]
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1))
      diagonal = above
    }
  }
  return previous[right.length]
}

function cityScore(city: City, query: string) {
  const normalized = normalize(query)
  if (!normalized) return 0
  if (city.search.startsWith(normalized)) return 100 - city.search.length / 100
  if (city.search.includes(normalized)) return 80 - city.search.indexOf(normalized)
  const cityName = normalize(city.name)
  const typedCity = normalized.replace(/\s+[a-z]{2}$/, '')
  const distance = editDistance(cityName, typedCity)
  return distance <= Math.max(1, Math.floor(typedCity.length / 4)) ? 60 - distance * 5 : -1
}

export function useDirectorySpecialties(selected = '') {
  const [remote, setRemote] = useState<string[]>([])
  useEffect(() => { let active = true; void listActiveSpecialties().then(rows => { if (active) setRemote(rows.map(row => row.name)) }).catch(() => undefined); return () => { active = false } }, [])
  return useMemo(() => [...new Set([...maternalChildSpecialties, ...remote, selected].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [remote, selected])
}

export function CityAutocomplete({ defaultValue = '', name='city', onSelect, required=false }: { defaultValue?: string; name?: string; onSelect?:(label:string)=>void; required?:boolean }) {
  const [value, setValue] = useState(defaultValue)
  const [cities, setCities] = useState<City[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let active = true
    const cached = sessionStorage.getItem('materplace-brazilian-cities-v1')
    if (cached) { try { setCities(JSON.parse(cached)); return () => { active = false } } catch { /* recarrega abaixo */ } }
    void fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome')
      .then(response => response.ok ? response.json() : Promise.reject(new Error('IBGE indisponível')))
      .then((rows: any[]) => rows.map(row => {
        const state = row.microrregiao?.mesorregiao?.UF?.sigla || row['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla || ''
        const label = `${row.nome}, ${state}`
        return { name: row.nome, state, label, search: normalize(label) }
      }).filter(city => city.state))
      .then(items => { if (!active) return; setCities(items); try { sessionStorage.setItem('materplace-brazilian-cities-v1', JSON.stringify(items)) } catch { /* cache opcional */ } })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  const suggestions = useMemo(() => value.trim().length < 2 ? [] : cities.map(city => ({ city, score: cityScore(city, value) })).filter(item => item.score >= 0).sort((a, b) => b.score - a.score || a.city.label.localeCompare(b.city.label, 'pt-BR')).slice(0, 8).map(item => item.city), [cities, value])

  return <span className="city-autocomplete">
    <input name={name} value={value} required={required} autoComplete="off" placeholder="Comece a digitar a cidade" onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 120)} onChange={event => { setValue(event.target.value); setOpen(true) }} aria-autocomplete="list" aria-expanded={open && suggestions.length > 0} />
    {open && suggestions.length > 0 && <span className="city-suggestions" role="listbox">{suggestions.map(city => <button type="button" role="option" key={`${city.state}-${city.name}`} onMouseDown={event => event.preventDefault()} onClick={() => { setValue(onSelect?'':city.label);setOpen(false);onSelect?.(city.label) }}>{city.name}<small>{city.state}</small></button>)}</span>}
  </span>
}
