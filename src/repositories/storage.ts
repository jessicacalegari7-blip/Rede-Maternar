export interface Repository<T extends { id: string }> {
  list(): T[]
  find(id: string): T | undefined
  save(entity: T): T
}

export class LocalRepository<T extends { id: string }> implements Repository<T> {
  constructor(private readonly key: string, private readonly seed: T[]) {}

  list(): T[] {
    if (typeof window === 'undefined') return structuredClone(this.seed)
    const raw = window.localStorage.getItem(this.key)
    if (!raw) {
      window.localStorage.setItem(this.key, JSON.stringify(this.seed))
      return structuredClone(this.seed)
    }
    try { return JSON.parse(raw) as T[] }
    catch {
      window.localStorage.setItem(this.key, JSON.stringify(this.seed))
      return structuredClone(this.seed)
    }
  }

  find(id: string) { return this.list().find(item => item.id === id) }

  save(entity: T) {
    const next = [entity, ...this.list().filter(item => item.id !== entity.id)]
    if (typeof window !== 'undefined') window.localStorage.setItem(this.key, JSON.stringify(next))
    return entity
  }
}
