import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { localAppRepo } from '../data/repositories'
import {
  emptyAppData,
  seedExampleAppData,
} from '../data/migrations'
import { createBlankScenario } from '../data/exampleScenario'
import { computeFinance } from '../domain/finance/calculations'
import { evaluateReadiness } from '../domain/insights/readiness'
import type {
  AppData,
  SavedPlace,
  Scenario,
  WizardStepId,
} from '../domain/types'

const STEP_ORDER: WizardStepId[] = ['welcome', 'stay', 'move', 'picture']

/**
 * App data is identity-scoped in localStorage (guest vs user:<id>).
 * Pass auth ready + workspaceUserId so we never load/save the wrong bag.
 */
export function useApp(workspaceUserId: string | null, authReady: boolean) {
  const [data, setData] = useState<AppData>(emptyAppData())
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workspaceKey, setWorkspaceKey] = useState<string>('')
  const savingPaused = useRef(true)

  useEffect(() => {
    if (!authReady) return
    let cancelled = false
    savingPaused.current = true
    setReady(false)
    ;(async () => {
      try {
        const loaded = await localAppRepo.switchWorkspace(workspaceUserId)
        if (cancelled) return
        setData(loaded)
        setWorkspaceKey(localAppRepo.activeKey)
        setReady(true)
        savingPaused.current = false
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load saved data.')
          setData(emptyAppData())
          setReady(true)
          savingPaused.current = false
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authReady, workspaceUserId])

  useEffect(() => {
    if (!ready || savingPaused.current || !workspaceKey) return
    const id = window.setTimeout(() => {
      void localAppRepo.save(data)
    }, 250)
    return () => window.clearTimeout(id)
  }, [data, ready, workspaceKey])

  const updateData = useCallback((updater: (prev: AppData) => AppData) => {
    setData((prev) => updater(prev))
  }, [])

  const startExample = useCallback(() => {
    setData(seedExampleAppData())
  }, [])

  const startFresh = useCallback(() => {
    setData({
      ...emptyAppData(),
      scenario: createBlankScenario(),
      ui: {
        activeStep: 'stay',
        mode: 'guide',
        completedSteps: ['welcome'],
      },
    })
  }, [])

  const setScenario = useCallback((scenario: Scenario) => {
    updateData((prev) => ({
      ...prev,
      scenario: { ...scenario, updatedAt: new Date().toISOString() },
    }))
  }, [updateData])

  const patchScenario = useCallback(
    (patch: Partial<Scenario>) => {
      updateData((prev) => {
        if (!prev.scenario) return prev
        return {
          ...prev,
          scenario: {
            ...prev.scenario,
            ...patch,
            updatedAt: new Date().toISOString(),
          },
        }
      })
    },
    [updateData],
  )

  const goToStep = useCallback((step: WizardStepId) => {
    // Free navigation does not invent "completed" — only Continue does that.
    updateData((prev) => ({
      ...prev,
      ui: {
        ...prev.ui,
        mode: 'guide',
        activeStep: step,
      },
    }))
  }, [updateData])

  const nextStep = useCallback(() => {
    updateData((prev) => {
      const idx = STEP_ORDER.indexOf(prev.ui.activeStep)
      const next = STEP_ORDER[Math.min(STEP_ORDER.length - 1, idx + 1)]
      const completed = new Set(prev.ui.completedSteps)
      completed.add(prev.ui.activeStep)
      completed.add(next)
      return {
        ...prev,
        ui: {
          ...prev.ui,
          mode: 'guide',
          activeStep: next,
          completedSteps: Array.from(completed),
        },
      }
    })
  }, [updateData])

  const prevStep = useCallback(() => {
    updateData((prev) => {
      const idx = STEP_ORDER.indexOf(prev.ui.activeStep)
      const back = STEP_ORDER[Math.max(0, idx - 1)]
      return {
        ...prev,
        ui: { ...prev.ui, mode: 'guide', activeStep: back },
      }
    })
  }, [updateData])

  const setMode = useCallback((mode: 'guide' | 'places') => {
    updateData((prev) => ({ ...prev, ui: { ...prev.ui, mode } }))
  }, [updateData])

  const upsertPlace = useCallback((place: SavedPlace) => {
    updateData((prev) => {
      const exists = prev.places.some((p) => p.id === place.id)
      const places = exists
        ? prev.places.map((p) => (p.id === place.id ? place : p))
        : [place, ...prev.places]
      return { ...prev, places }
    })
  }, [updateData])

  const removePlace = useCallback((id: string) => {
    updateData((prev) => ({
      ...prev,
      places: prev.places.filter((p) => p.id !== id),
    }))
  }, [updateData])

  const replacePlaces = useCallback((places: SavedPlace[]) => {
    updateData((prev) => ({ ...prev, places }))
  }, [updateData])

  const eraseAll = useCallback(async () => {
    await localAppRepo.clearActive()
    setData(emptyAppData())
  }, [])

  const exportData = useCallback(async () => {
    const json = await localAppRepo.exportJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `next-chapter-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const importData = useCallback(async (file: File) => {
    const text = await file.text()
    const imported = await localAppRepo.importJson(text)
    setData(imported)
  }, [])

  const finance = useMemo(
    () =>
      data.scenario
        ? computeFinance(data.scenario.home, data.scenario.move)
        : null,
    [data.scenario],
  )

  const readiness = useMemo(
    () => (data.scenario ? evaluateReadiness(data.scenario) : null),
    [data.scenario],
  )

  const stepIndex = STEP_ORDER.indexOf(data.ui.activeStep)

  return {
    ready,
    error,
    data,
    scenario: data.scenario,
    places: data.places,
    ui: data.ui,
    finance,
    readiness,
    steps: STEP_ORDER,
    stepIndex,
    workspaceUserId,
    isGuestWorkspace: workspaceUserId == null,
    startExample,
    startFresh,
    setScenario,
    patchScenario,
    goToStep,
    nextStep,
    prevStep,
    setMode,
    upsertPlace,
    removePlace,
    replacePlaces,
    eraseAll,
    exportData,
    importData,
  }
}

export type AppController = ReturnType<typeof useApp>
