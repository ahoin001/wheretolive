import { useCallback, useEffect, useMemo, useState } from 'react'
import { localAppRepo } from '../data/repositories'
import {
  emptyAppData,
  migrateAppData,
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

const STEP_ORDER: WizardStepId[] = [
  'welcome',
  'household',
  'today',
  'paths',
  'peace',
  'easier',
  'talk',
  'summary',
]

export function useApp() {
  const [data, setData] = useState<AppData>(emptyAppData())
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const loaded = await localAppRepo.load()
        if (!cancelled) {
          setData(migrateAppData(loaded))
          setReady(true)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load saved data.')
          setReady(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    const id = window.setTimeout(() => {
      void localAppRepo.save(data)
    }, 250)
    return () => window.clearTimeout(id)
  }, [data, ready])

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
        activeStep: 'household',
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
    updateData((prev) => ({
      ...prev,
      ui: {
        ...prev.ui,
        mode: 'guide',
        activeStep: step,
        completedSteps: prev.ui.completedSteps.includes(step)
          ? prev.ui.completedSteps
          : [...prev.ui.completedSteps, step],
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

  const eraseAll = useCallback(async () => {
    await localAppRepo.clear()
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
    eraseAll,
    exportData,
    importData,
  }
}

export type AppController = ReturnType<typeof useApp>
