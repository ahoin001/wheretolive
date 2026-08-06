import type { AppData, SavedPlace, Scenario } from '../../domain/types'

/**
 * Persistence boundary. Local adapter first; Supabase can implement the same shape later.
 */
export interface AppRepository {
  load(): Promise<AppData>
  save(data: AppData): Promise<void>
  clear(): Promise<void>
  exportJson(): Promise<string>
  importJson(json: string): Promise<AppData>
}

export type ScenarioPatch = Partial<Scenario>
export type PlacePatch = Partial<SavedPlace>
