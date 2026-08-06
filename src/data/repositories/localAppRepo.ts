import { migrateAppData, emptyAppData } from '../migrations'
import type { AppData, SavedPlace } from '../../domain/types'
import type { AppRepository } from './types'

/**
 * Identity-scoped local cache.
 * - Guest / signed-out: `next-chapter.app.v1:guest`
 * - Signed-in: `next-chapter.app.v1:user:<uuid>`
 * Never share one bag across accounts on the same browser.
 */
const LEGACY_KEY = 'next-chapter.app.v1'
const GUEST_KEY = 'next-chapter.app.v1:guest'

function userKey(userId: string): string {
  return `next-chapter.app.v1:user:${userId}`
}

function readRaw(key: string): AppData {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return emptyAppData()
    return migrateAppData(JSON.parse(raw))
  } catch {
    return emptyAppData()
  }
}

function writeRaw(key: string, data: AppData): void {
  localStorage.setItem(key, JSON.stringify(data))
}

/** One-time: move unscoped legacy blob into the guest workspace. */
function migrateLegacyToGuest(): void {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (!legacy) return
    if (!localStorage.getItem(GUEST_KEY)) {
      localStorage.setItem(GUEST_KEY, legacy)
    }
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // ignore storage failures
  }
}

export type WorkspaceScope = 'guest' | { userId: string }

export class LocalAppRepository implements AppRepository {
  private scope: WorkspaceScope = 'guest'

  /** Active identity for load/save. `null` userId → guest. */
  get activeKey(): string {
    if (this.scope === 'guest') return GUEST_KEY
    return userKey(this.scope.userId)
  }

  get isGuest(): boolean {
    return this.scope === 'guest'
  }

  get workspaceUserId(): string | null {
    return this.scope === 'guest' ? null : this.scope.userId
  }

  /**
   * Switch which blob is active, then load it.
   * Does not copy data between guest and user workspaces.
   */
  async switchWorkspace(userId: string | null): Promise<AppData> {
    migrateLegacyToGuest()
    this.scope = userId ? { userId } : 'guest'
    return this.load()
  }

  /** Peek places saved as guest without changing the active workspace. */
  async peekGuestPlaces(): Promise<SavedPlace[]> {
    migrateLegacyToGuest()
    return readRaw(GUEST_KEY).places
  }

  /** Peek full guest AppData (for optional import of guide + places). */
  async peekGuestData(): Promise<AppData> {
    migrateLegacyToGuest()
    return readRaw(GUEST_KEY)
  }

  async load(): Promise<AppData> {
    migrateLegacyToGuest()
    return readRaw(this.activeKey)
  }

  async save(data: AppData): Promise<void> {
    writeRaw(this.activeKey, data)
  }

  async clear(): Promise<void> {
    localStorage.removeItem(this.activeKey)
  }

  /** Clear only the active workspace (used by erase). */
  async clearActive(): Promise<void> {
    await this.clear()
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
