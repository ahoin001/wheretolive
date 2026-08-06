import { migrateAppData, emptyAppData } from '../migrations'
import type { AppData } from '../../domain/types'
import type { AppRepository } from './types'

const STORAGE_KEY = 'next-chapter.app.v1'

export class LocalAppRepository implements AppRepository {
  async load(): Promise<AppData> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return emptyAppData()
      return migrateAppData(JSON.parse(raw))
    } catch {
      return emptyAppData()
    }
  }

  async save(data: AppData): Promise<void> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  async clear(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY)
  }

  async exportJson(): Promise<string> {
    const data = await this.load()
    return JSON.stringify(data, null, 2)
  }

  async importJson(json: string): Promise<AppData> {
    const parsed = migrateAppData(JSON.parse(json))
    await this.save(parsed)
    return parsed
  }
}

export const localAppRepo = new LocalAppRepository()

/**
 * Future Supabase adapter sketch (not wired in v1):
 *
 * export class SupabaseAppRepository implements AppRepository {
 *   constructor(private client: SupabaseClient) {}
 *   async load() { ... select from scenarios / places with RLS ... }
 *   async save() { ... upsert ... }
 * }
 */
