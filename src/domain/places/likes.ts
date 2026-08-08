/** Stable multi-person like colors — hash user id so labels stay the same across places. */

import type { SavedPlace } from '../types'
import { ms } from './filtering'

export const LIKER_SWATCHES = [
  {
    chip: 'border-honey/45 bg-honey-soft text-[#8a5524]',
    heart: 'text-honey fill-honey',
    badge: 'bg-honey text-white',
    onFill: 'border-honey bg-honey text-white hover:bg-honey/90',
  },
  {
    chip: 'border-sea/50 bg-sea/15 text-sea-deep',
    heart: 'text-sea-deep fill-sea',
    badge: 'bg-sea text-white',
    onFill: 'border-sea bg-sea text-white hover:bg-sea/90',
  },
  {
    chip: 'border-keep/45 bg-keep/15 text-keep',
    heart: 'text-keep fill-keep',
    badge: 'bg-keep text-white',
    onFill: 'border-keep bg-keep text-white hover:bg-keep/90',
  },
  {
    chip: 'border-move/50 bg-move/15 text-move',
    heart: 'text-move fill-move',
    badge: 'bg-move text-white',
    onFill: 'border-move bg-move text-white hover:bg-move/90',
  },
  {
    chip: 'border-warn/45 bg-[#f6ebd6] text-warn',
    heart: 'text-warn fill-warn',
    badge: 'bg-warn text-white',
    onFill: 'border-warn bg-warn text-white hover:bg-warn/90',
  },
  {
    chip: 'border-[#6b8e7a]/45 bg-[#e6f0ea] text-[#3f5e4e]',
    heart: 'text-[#4f7261] fill-[#4f7261]',
    badge: 'bg-[#4f7261] text-white',
    onFill: 'border-[#4f7261] bg-[#4f7261] text-white hover:bg-[#436355]',
  },
  {
    chip: 'border-[#b56b6b]/40 bg-[#f6e8e8] text-[#7a3d3d]',
    heart: 'text-[#b56b6b] fill-[#b56b6b]',
    badge: 'bg-[#b56b6b] text-white',
    onFill: 'border-[#b56b6b] bg-[#b56b6b] text-white hover:bg-[#a35c5c]',
  },
  {
    chip: 'border-[#5c7a99]/45 bg-[#e8eef5] text-[#3a5470]',
    heart: 'text-[#5c7a99] fill-[#5c7a99]',
    badge: 'bg-[#5c7a99] text-white',
    onFill: 'border-[#5c7a99] bg-[#5c7a99] text-white hover:bg-[#4f6b88]',
  },
] as const

export type LikerSwatch = (typeof LIKER_SWATCHES)[number]

export function hashUserId(userId: string): number {
  let h = 2166136261
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function swatchForUser(userId: string): LikerSwatch {
  return LIKER_SWATCHES[hashUserId(userId) % LIKER_SWATCHES.length]!
}

/** Per-user likers for shared boards, most recent heart first. */
export function likedByPeople(
  place: SavedPlace,
  currentUserId: string | undefined,
): { key: string; label: string; swatch: LikerSwatch }[] {
  const likers =
    place.likedBy && place.likedBy.length
      ? [...place.likedBy].sort((a, b) => ms(b.likedAt) - ms(a.likedAt))
      : (place.likedByUserIds ?? []).map((userId) => ({
          userId,
          displayName: 'Someone',
          likedAt: null as string | null,
        }))

  return likers.map((l) => {
    const isMe = Boolean(currentUserId && l.userId === currentUserId)
    return {
      key: l.userId,
      label: isMe ? 'You' : l.displayName || 'Someone',
      swatch: swatchForUser(l.userId),
    }
  })
}
