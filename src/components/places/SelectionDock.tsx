import {
  ArrowUp,
  Copy,
  Link2,
  MoreHorizontal,
  Plus,
  Share2,
  Square,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react'
import type { CollaborationController } from '../../hooks/useCollaboration'
import type { PlaceTier } from '../../domain/types'
import { Button } from '../ui/Button'
import { CopyToListMenu } from './ListsManager'
import { FloatingListDock } from './FloatingListDock'
import { cn } from '../../lib/utils'
import { TIER_META, TIERS } from './tier/tierMeta'

export type FloatingTierMode = 'focus' | 'overview'

export type FloatingTierNavProps = {
  activeTier: PlaceTier
  mode: FloatingTierMode
  counts: Record<PlaceTier, number>
  onSelectTier: (tier: PlaceTier) => void
}

export function FloatingTierChips({
  activeTier,
  mode,
  counts,
  onSelectTier,
}: FloatingTierNavProps) {
  return (
    <div
      role="group"
      aria-label={
        mode === 'overview' ? 'Jump to tier section' : 'Switch focus tier'
      }
      className="grid w-full grid-cols-4 gap-1"
    >
      {TIERS.map((tier) => {
        const meta = TIER_META[tier]
        const active = activeTier === tier
        const count = counts[tier] ?? 0
        return (
          <button
            key={tier}
            type="button"
            onClick={() => onSelectTier(tier)}
            className={cn(
              'flex min-h-9 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-0.5 py-1.5 text-[10px] font-bold leading-none',
              active
                ? meta.chipActive
                : cn('bg-panel', meta.chip, 'hover:border-sea/50'),
            )}
          >
            <span className="truncate">{meta.short}</span>
            <span className="tabular-nums opacity-80">{count}</span>
          </button>
        )
      })}
    </div>
  )
}

type SelectionDockProps = {
  open: boolean
  selectMode: boolean
  selectedCount: number
  cloudActive: boolean
  supabaseConfigured: boolean
  isMdUp: boolean
  activeFilterCount: number
  filtersOpen: boolean
  bulkCopyOpen: boolean
  selectMoreOpen: boolean
  selectedIds: string[]
  collab: CollaborationController
  tierNav?: FloatingTierNavProps | null
  onSelectAllVisible: () => void
  onSelectFullList: () => void
  onClearSelection: () => void
  onDeleteSelected: () => void
  onGuestLink: () => void
  onInvite: () => void
  onDoneSelecting: () => void
  onEnterSelectMode: () => void
  onAdd: () => void
  onOpenFilters: () => void
  onBulkCopyOpenChange: (open: boolean) => void
  onSelectMoreOpenChange: (open: boolean) => void
  onCopyDone: (msg: string) => void
  onScrollTop: () => void
  inviteDisabled: boolean
}

/**
 * Floating select + quick-action dock contents (uses FloatingListDock chrome).
 */
export function SelectionDock({
  open,
  selectMode,
  selectedCount,
  cloudActive,
  supabaseConfigured,
  isMdUp,
  activeFilterCount,
  filtersOpen,
  bulkCopyOpen,
  selectMoreOpen,
  selectedIds,
  collab,
  tierNav,
  onSelectAllVisible,
  onSelectFullList,
  onClearSelection,
  onDeleteSelected,
  onGuestLink,
  onInvite,
  onDoneSelecting,
  onEnterSelectMode,
  onAdd,
  onOpenFilters,
  onBulkCopyOpenChange,
  onSelectMoreOpenChange,
  onCopyDone,
  onScrollTop,
  inviteDisabled,
}: SelectionDockProps) {
  const stacked = Boolean(tierNav)

  const selectActions = (
    <>
      <p className="shrink-0 text-sm font-bold tabular-nums text-ink">
        {selectedCount}
        <span className="hidden sm:inline"> selected</span>
      </p>
      <Button
        type="button"
        variant="ghost"
        className="hidden min-h-11 px-2.5 text-sm sm:inline-flex md:h-9 md:min-h-9"
        onClick={onSelectAllVisible}
      >
        All shown
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="hidden min-h-11 px-2.5 text-sm md:inline-flex md:h-9 md:min-h-9"
        onClick={onSelectFullList}
      >
        Full list
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="hidden min-h-11 px-2.5 text-sm sm:inline-flex md:h-9 md:min-h-9"
        onClick={onClearSelection}
      >
        Clear
      </Button>
      {selectedCount > 0 && cloudActive ? (
        <div className="relative hidden sm:block">
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 px-2.5 text-sm md:h-9 md:min-h-9"
            onClick={() => onBulkCopyOpenChange(!bulkCopyOpen)}
          >
            <Copy className="h-4 w-4" />
            <span className="hidden sm:inline">Copy</span>
          </Button>
          {bulkCopyOpen ? (
            <div className="absolute bottom-full left-0 z-30 mb-2 w-[min(18rem,calc(100vw-2rem))]">
              <CopyToListMenu
                collab={collab}
                placeIds={selectedIds}
                onDone={(msg) => {
                  onCopyDone(msg)
                  onBulkCopyOpenChange(false)
                }}
                onCancel={() => onBulkCopyOpenChange(false)}
              />
            </div>
          ) : null}
        </div>
      ) : null}
      {selectedCount > 0 ? (
        <Button
          type="button"
          variant="danger"
          className="min-h-11 min-w-11 px-2.5 md:h-9 md:min-h-9"
          onClick={onDeleteSelected}
          aria-label="Delete selected"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
      {selectedCount > 0 && supabaseConfigured ? (
        <Button
          type="button"
          variant="secondary"
          className="hidden min-h-11 px-2.5 text-sm sm:inline-flex md:h-9 md:min-h-9"
          onClick={onGuestLink}
          aria-label="Guest link"
          title="Create a guest link"
        >
          <Link2 className="h-4 w-4" />
          <span className="hidden sm:inline">Guest link</span>
        </Button>
      ) : null}
      <Button
        type="button"
        variant="honey"
        className="ml-auto min-h-11 min-w-11 px-3 md:h-9 md:min-h-9"
        onClick={onInvite}
        disabled={inviteDisabled}
        aria-label="Share with people"
      >
        <Share2 className="h-4 w-4" />
        <span className="hidden sm:inline">Invite</span>
      </Button>
      <div className="relative sm:hidden">
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 min-w-11 px-2"
          aria-label="More select actions"
          aria-expanded={selectMoreOpen}
          onClick={() => onSelectMoreOpenChange(!selectMoreOpen)}
        >
          <MoreHorizontal className="h-5 w-5" />
        </Button>
        {selectMoreOpen ? (
          <div className="absolute bottom-full right-0 z-30 mb-2 min-w-[10rem] overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-[var(--shadow-lift)]">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold text-ink hover:bg-folio"
              onClick={() => {
                onSelectAllVisible()
                onSelectMoreOpenChange(false)
              }}
            >
              All shown
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold text-ink hover:bg-folio"
              onClick={() => {
                onClearSelection()
                onSelectMoreOpenChange(false)
              }}
            >
              Clear
            </button>
            {selectedCount > 0 && supabaseConfigured ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold text-ink hover:bg-folio"
                onClick={() => {
                  onGuestLink()
                  onSelectMoreOpenChange(false)
                }}
              >
                <Link2 className="h-4 w-4" />
                Guest link
              </button>
            ) : null}
            {selectedCount > 0 && cloudActive ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold text-ink hover:bg-folio"
                onClick={() => {
                  onBulkCopyOpenChange(true)
                  onSelectMoreOpenChange(false)
                }}
              >
                <Copy className="h-4 w-4" />
                Copy to list
              </button>
            ) : null}
          </div>
        ) : null}
        {bulkCopyOpen && selectedCount > 0 && cloudActive ? (
          <div className="absolute bottom-full right-0 z-30 mb-2 w-[min(18rem,calc(100vw-2rem))] sm:hidden">
            <CopyToListMenu
              collab={collab}
              placeIds={selectedIds}
              onDone={(msg) => {
                onCopyDone(msg)
                onBulkCopyOpenChange(false)
              }}
              onCancel={() => onBulkCopyOpenChange(false)}
            />
          </div>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 min-w-11 px-2"
        onClick={onDoneSelecting}
        aria-label="Done selecting"
      >
        <X className="h-4 w-4" />
      </Button>
    </>
  )

  const quickActionsStacked = (
    <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)_2.75rem] items-center gap-1.5">
      <Button
        type="button"
        variant="secondary"
        className="min-h-11 min-w-0 px-2 text-sm"
        onClick={onEnterSelectMode}
      >
        <Square className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Select</span>
      </Button>
      <Button
        type="button"
        variant="honey"
        className="min-h-11 min-w-0 px-2 text-sm"
        onClick={onAdd}
      >
        <Plus className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Add</span>
      </Button>
      {!isMdUp ? (
        <Button
          type="button"
          variant={
            filtersOpen || activeFilterCount > 0 ? 'primary' : 'secondary'
          }
          className="min-h-11 min-w-0 px-2 text-sm"
          onClick={onOpenFilters}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {activeFilterCount > 0 ? `Filters · ${activeFilterCount}` : 'Filters'}
          </span>
        </Button>
      ) : (
        <span />
      )}
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 min-w-11 justify-self-end px-0"
        onClick={onScrollTop}
        aria-label="Back to top"
        title="Back to top"
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
    </div>
  )

  const quickActionsRow = (
    <>
      <Button
        type="button"
        variant="secondary"
        className="min-h-11 px-3 text-sm md:h-9 md:min-h-9"
        onClick={onEnterSelectMode}
      >
        <Square className="h-3.5 w-3.5" />
        Select
      </Button>
      <Button
        type="button"
        variant="honey"
        className="min-h-11 px-3 text-sm md:h-9 md:min-h-9"
        onClick={onAdd}
      >
        <Plus className="h-3.5 w-3.5" />
        Add
      </Button>
      {!isMdUp ? (
        <Button
          type="button"
          variant={
            filtersOpen || activeFilterCount > 0 ? 'primary' : 'secondary'
          }
          className="min-h-11 px-3 text-sm"
          onClick={onOpenFilters}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 text-[11px]">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        className="ml-auto min-h-11 min-w-11 px-2 md:h-9 md:min-h-9"
        onClick={onScrollTop}
        aria-label="Back to top"
        title="Back to top"
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
    </>
  )

  return (
    <FloatingListDock
      open={open}
      layout={stacked ? 'stack' : 'row'}
      aria-label={selectMode ? 'Selection actions' : 'List quick actions'}
    >
      {tierNav ? (
        <div className="border-b border-line/70 pb-2">
          <FloatingTierChips {...tierNav} />
        </div>
      ) : null}
      {selectMode ? (
        stacked ? (
          <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5">
            {selectActions}
          </div>
        ) : (
          selectActions
        )
      ) : stacked ? (
        quickActionsStacked
      ) : (
        quickActionsRow
      )}
    </FloatingListDock>
  )
}

/** Spacer so list content clears the floating dock. */
export function SelectionDockSpacer({
  open,
  tall = false,
}: {
  open: boolean
  /** Extra height when tier chips are stacked above actions. */
  tall?: boolean
}) {
  if (!open) return null
  return (
    <div
      className={tall ? 'h-32 shrink-0 md:h-16' : 'h-20 shrink-0 md:h-16'}
      aria-hidden
    />
  )
}
