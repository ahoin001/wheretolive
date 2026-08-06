import { useState, type DragEvent } from 'react'
import { GripVertical, ImageIcon, Star, X } from 'lucide-react'
import { motion } from '../../lib/motion'
import { cn } from '../../lib/utils'
import { OpenableImage } from './ImageLightbox'

function reorderImages(images: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= images.length || to >= images.length) {
    return images
  }
  const next = [...images]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

function moveToFront(images: string[], index: number): string[] {
  if (index <= 0 || index >= images.length) return images
  const next = [...images]
  const [moved] = next.splice(index, 1)
  next.unshift(moved)
  return next
}

export function PlacePhotoEditor({
  images,
  title,
  onChange,
  onOpen,
}: {
  images: string[]
  title: string
  onChange: (images: string[]) => void
  onOpen: (images: string[], index: number, title?: string) => void
}) {
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  if (images.length === 0) return null

  const clearDrag = () => {
    setDragFrom(null)
    setDragOver(null)
  }

  const handleDragStart = (index: number) => (e: DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
    // Delay so the drag preview paints before we dim the source
    requestAnimationFrame(() => setDragFrom(index))
  }

  const handleDragOver = (index: number) => (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOver !== index) setDragOver(index)
  }

  const handleDrop = (index: number) => (e: DragEvent) => {
    e.preventDefault()
    const raw = e.dataTransfer.getData('text/plain')
    const from = Number.parseInt(raw, 10)
    if (!Number.isFinite(from)) {
      clearDrag()
      return
    }
    onChange(reorderImages(images, from, index))
    clearDrag()
  }

  return (
    <ul className="mt-3 grid grid-cols-2 gap-3" role="list">
      {images.map((url, index) => {
        const isPrimary = index === 0
        const isDragging = dragFrom === index
        const isDropTarget = dragOver === index && dragFrom !== null && dragFrom !== index

        return (
          <li
            key={`${url}-${index}`}
            onDragOver={handleDragOver(index)}
            onDragLeave={() => {
              if (dragOver === index) setDragOver(null)
            }}
            onDrop={handleDrop(index)}
            className={cn(
              'relative overflow-hidden rounded-xl border bg-folio',
              motion.color,
              isPrimary ? 'border-sea ring-2 ring-sea/25' : 'border-line',
              isDragging && 'opacity-45',
              isDropTarget && 'border-honey ring-2 ring-honey/40',
            )}
          >
            <div className="relative">
              <OpenableImage
                images={images}
                index={index}
                title={title}
                onOpen={onOpen}
                className="h-28 w-full"
                imgClassName="h-28"
              />
              <div className="absolute left-2 top-2 flex items-center gap-1">
                <button
                  type="button"
                  draggable
                  onDragStart={handleDragStart(index)}
                  onDragEnd={clearDrag}
                  className={cn(
                    'inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-lg bg-ink/65 text-white shadow-sm hover:bg-ink/80 active:cursor-grabbing',
                    motion.interactive,
                  )}
                  title="Drag to reorder"
                  aria-label={`Drag to reorder photo ${index + 1}`}
                >
                  <GripVertical className="h-4 w-4" />
                </button>
                {isPrimary ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-sea px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Main
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-between gap-1.5 px-2 py-2">
              <span className="truncate text-xs text-ink-soft">
                {isPrimary ? 'Main thumbnail' : `Photo ${index + 1}`}
              </span>
              <div className="flex shrink-0 items-center gap-0.5">
                {!isPrimary ? (
                  <button
                    type="button"
                    className={cn(
                      'rounded-full p-1.5 text-ink-soft hover:bg-panel hover:text-sea',
                      motion.chip,
                    )}
                    title="Set as main thumbnail"
                    aria-label="Set as main thumbnail"
                    onClick={() => onChange(moveToFront(images, index))}
                  >
                    <Star className="h-4 w-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  className={cn(
                    'rounded-full p-1.5 text-ink-soft hover:bg-panel hover:text-ink',
                    motion.chip,
                  )}
                  aria-label="Remove photo"
                  onClick={() => onChange(images.filter((_, i) => i !== index))}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
