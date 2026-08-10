import type { PlaceStatus, SavedPlace } from '../types'

export const PLACE_STATUS_LABEL: Record<PlaceStatus, string> = {
  none: 'Not marked',
  visited: 'Visited',
  offer: 'Offer',
  taken: 'Taken',
}

export function isPlaceTaken(
  place: Pick<SavedPlace, 'status'> | null | undefined,
): boolean {
  return place?.status === 'taken'
}

export function takenPlacesIn(
  places: readonly SavedPlace[],
): SavedPlace[] {
  return places.filter(isPlaceTaken)
}

export function availablePlacesIn(
  places: readonly SavedPlace[],
): SavedPlace[] {
  return places.filter((p) => !isPlaceTaken(p))
}
