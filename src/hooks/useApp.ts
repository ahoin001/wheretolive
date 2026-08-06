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

const STEP_ORDER: WizardStepId[] = ['stay', 'move', 'picture']

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
    setData((prev) => {
      const example = seedExampleAppData()
      return {
        ...example,
        places: prev.places,
        ui: {
          ...example.ui,
          mode: 'guide',
          activeStep: 'stay',
          completedSteps: [],
        },
      }
    })
  }, [])

  const startFresh = useCallback(() => {
    setData((prev) => ({
      ...prev,
      scenario: createBlankScenario(),
      ui: {
        ...prev.ui,
        activeStep: 'stay',
        mode: 'guide',
        completedSteps: [],
      },
    }))
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
    const safe =
      step === 'stay' || step === 'move' || step === 'picture' ? step : 'stay'
    updateData((prev) => ({
      ...prev,
      scenario: prev.scenario ?? createBlankScenario(),
      ui: {
        ...prev.ui,
        mode: 'guide',
        activeStep: safe,
      },
    }))
  }, [updateData])

  const nextStep = useCallback(() => {
    updateData((prev) => {
      const idx = STEP_ORDER.indexOf(prev.ui.activeStep)
      const from = idx >= 0 ? idx : 0
      const next = STEP_ORDER[Math.min(STEP_ORDER.length - 1, from + 1)]
      const completed = new Set(
        prev.ui.completedSteps.filter((s) =>
          STEP_ORDER.includes(s as WizardStepId),
        ),
      )
      completed.add(STEP_ORDER[from]!)
      completed.add(next)
      return {
        ...prev,
        scenario: prev.scenario ?? createBlankScenario(),
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
      const from = idx >= 0 ? idx : 0
      const back = STEP_ORDER[Math.max(0, from - 1)]
      return {
        ...prev,
        ui: { ...prev.ui, mode: 'guide', activeStep: back },
      }
    })
  }, [updateData])

  const setMode = useCallback((mode: 'guide' | 'places') => {
    updateData((prev) => {
      if (mode !== 'guide') {
        return { ...prev, ui: { ...prev.ui, mode } }
      }
      const step =
        prev.ui.activeStep === 'stay' ||
        prev.ui.activeStep === 'move' ||
        prev.ui.activeStep === 'picture'
          ? prev.ui.activeStep
          : 'stay'
      return {
        ...prev,
        scenario: prev.scenario ?? createBlankScenario(),
        ui: {
          ...prev.ui,
          mode: 'guide',
          activeStep: step,
          completedSteps: prev.ui.completedSteps.filter(
            (s) => s === 'stay' || s === 'move' || s === 'picture',
          ),
        },
      }
    })
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

  const removePlaces = useCallback((ids: string[]) => {
    if (!ids.length) return
    const drop = new Set(ids)
    updateData((prev) => ({
      ...prev,
      places: prev.places.filter((p) => !drop.has(p.id)),
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

  const stepIndex = Math.max(0, STEP_ORDER.indexOf(data.ui.activeStep))

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
    removePlaces,
    replacePlaces,
    eraseAll,
    exportData,
    importData,
  }
}

export type AppController = ReturnType<typeof useApp>
