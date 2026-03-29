import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react'
import './App.css'
import { CycleTracker } from './components/CycleTracker'
import { HelpPanel } from './components/HelpPanel'
import { SectionCard } from './components/SectionCard'
import { SliderField } from './components/SliderField'
import {
  getDefaultLoop,
  getLoopById,
  PRESETS,
  TAAL_BY_ID,
  TAALS,
} from './data/taals'
import { SurSaathAudioEngine } from './lib/audioEngine'
import { clampTempo, clampUnitLevel, MAX_TEMPO, MIN_TEMPO } from './lib/music'
import { loadSettings, saveSettings } from './lib/storage'
import {
  finalizeTapLoop,
  formatTapLoopPreview,
  registerTapLoopTap,
} from './lib/tapLoop'
import {
  TONICS,
  type AppSettings,
  type CyclePosition,
  type PlaybackState,
  type TapLoopCaptureState,
  type TapLoopPattern,
} from './types/music'

const TAP_LOOP_IDLE_MS = 1400

function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [initialEngineState] = useState(() => {
    const taal = TAAL_BY_ID[settings.taalId]

    return {
      taal,
      loop: getLoopById(taal, settings.loopId),
      tonic: settings.tonic,
    }
  })

  const selectedTaal = TAAL_BY_ID[settings.taalId]
  const selectedLoop = getLoopById(selectedTaal, settings.loopId)

  const [playbackState, setPlaybackState] = useState<PlaybackState>('stopped')
  const [audioReady, setAudioReady] = useState(false)
  const [currentPosition, setCurrentPosition] = useState<CyclePosition>(() => ({
    matra: 1,
    cycle: 1,
    beat: initialEngineState.loop.beats[0],
    isSam: true,
    isKhali: initialEngineState.taal.khali.includes(1),
    isVibhagStart: true,
  }))
  const [tapLoopState, setTapLoopState] = useState<TapLoopCaptureState>('idle')
  const [tapLoopTapCount, setTapLoopTapCount] = useState(0)
  const [tapLoopPattern, setTapLoopPattern] = useState<TapLoopPattern | null>(null)

  const audioEngineRef = useRef<SurSaathAudioEngine | null>(null)
  const tapLoopHistoryRef = useRef<number[]>([])
  const tapLoopFinalizeTimeoutRef = useRef<number | null>(null)

  const clearTapLoopFinalizeTimeout = () => {
    if (tapLoopFinalizeTimeoutRef.current !== null) {
      window.clearTimeout(tapLoopFinalizeTimeoutRef.current)
      tapLoopFinalizeTimeoutRef.current = null
    }
  }

  const updateSettings = (updater: (current: AppSettings) => AppSettings) => {
    setSettings((current) => updater(current))
  }

  const handleCyclePosition = useEffectEvent((position: CyclePosition) => {
    setCurrentPosition(position)
  })

  const finalizeTapLoopCapture = (loopEndAt?: number) => {
    clearTapLoopFinalizeTimeout()

    const completedPattern = finalizeTapLoop({
      taps: tapLoopHistoryRef.current,
      beatCount: selectedLoop.beats.length,
      fallbackTempo: settings.tempo,
      sourceTaalId: selectedTaal.id,
      sourceLoopId: selectedLoop.id,
      loopEndAt,
    })

    tapLoopHistoryRef.current = []

    if (!completedPattern) {
      setTapLoopState('idle')
      setTapLoopTapCount(0)
      setTapLoopPattern(null)
      return
    }

    setTapLoopPattern(completedPattern)
    setTapLoopTapCount(completedPattern.tapCount)
    setTapLoopState('ready')

    updateSettings((current) => ({
      ...current,
      tempo: completedPattern.bpm,
    }))
  }

  useEffect(() => {
    const engine = new SurSaathAudioEngine(
      initialEngineState.taal,
      initialEngineState.loop,
      initialEngineState.tonic,
    )
    engine.setOnCyclePosition(handleCyclePosition)
    audioEngineRef.current = engine

    return () => {
      engine.dispose()
      audioEngineRef.current = null
    }
  }, [initialEngineState])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    audioEngineRef.current?.setTapLoop(tapLoopPattern)
  }, [tapLoopPattern])

  useEffect(() => {
    audioEngineRef.current?.setTaal(selectedTaal, selectedLoop)
  }, [selectedLoop, selectedTaal])

  useEffect(() => {
    audioEngineRef.current?.setTonic(settings.tonic)
  }, [settings.tonic])

  useEffect(() => {
    audioEngineRef.current?.setTempo(settings.tempo)
  }, [settings.tempo])

  useEffect(() => {
    audioEngineRef.current?.setTanpuraVolume(settings.tanpuraVolume)
  }, [settings.tanpuraVolume])

  useEffect(() => {
    audioEngineRef.current?.setPercussionVolume(settings.percussionVolume)
  }, [settings.percussionVolume])

  useEffect(() => {
    return () => {
      clearTapLoopFinalizeTimeout()
    }
  }, [])

  const cancelPendingTapLoopCapture = () => {
    if (tapLoopState !== 'capturing') {
      return
    }

    clearTapLoopFinalizeTimeout()
    tapLoopHistoryRef.current = []
    setTapLoopTapCount(tapLoopPattern?.tapCount ?? 0)
    setTapLoopState(tapLoopPattern ? 'ready' : 'idle')
  }

  const clearTapLoopOverlay = () => {
    clearTapLoopFinalizeTimeout()
    tapLoopHistoryRef.current = []
    setTapLoopPattern(null)
    setTapLoopTapCount(0)
    setTapLoopState('idle')
  }

  const resetPositionView = () => {
    setCurrentPosition({
      matra: 1,
      cycle: 1,
      beat: selectedLoop.beats[0],
      isSam: true,
      isKhali: selectedTaal.khali.includes(1),
      isVibhagStart: true,
    })
  }

  const handleStart = async () => {
    const engine = audioEngineRef.current

    if (!engine) {
      return
    }

    await engine.start()
    engine.setTempo(settings.tempo)
    engine.setTanpuraVolume(settings.tanpuraVolume)
    engine.setPercussionVolume(settings.percussionVolume)
    setAudioReady(true)
    setPlaybackState('playing')
  }

  const handlePause = () => {
    audioEngineRef.current?.pause()
    setPlaybackState('paused')
  }

  const handleStop = () => {
    audioEngineRef.current?.stop()
    resetPositionView()
    setPlaybackState('stopped')
    cancelPendingTapLoopCapture()
  }

  const handleReset = () => {
    audioEngineRef.current?.reset()
    resetPositionView()
    cancelPendingTapLoopCapture()
  }

  const handleTapLoopTap = async () => {
    const now = performance.now()
    const isNewCapture = tapLoopState !== 'capturing'

    if (isNewCapture) {
      setTapLoopPattern(null)
      setTapLoopState('capturing')
      setTapLoopTapCount(0)
      tapLoopHistoryRef.current = []
    }

    tapLoopHistoryRef.current = registerTapLoopTap(tapLoopHistoryRef.current, now)
    setTapLoopTapCount(tapLoopHistoryRef.current.length)
    clearTapLoopFinalizeTimeout()
    tapLoopFinalizeTimeoutRef.current = window.setTimeout(() => {
      finalizeTapLoopCapture()
    }, TAP_LOOP_IDLE_MS)

    if (audioEngineRef.current) {
      await audioEngineRef.current.previewTapLoopHit()
      setAudioReady(true)
    }
  }

  const handleFinishTapLoop = () => {
    if (tapLoopState !== 'capturing') {
      return
    }

    finalizeTapLoopCapture(performance.now())
  }

  const handleClearTapLoop = () => {
    clearTapLoopOverlay()
  }

  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find((item) => item.id === presetId)

    if (!preset) {
      return
    }

    startTransition(() => {
      const presetTaal = TAAL_BY_ID[preset.taalId]
      clearTapLoopOverlay()

      updateSettings((current) => ({
        ...current,
        taalId: preset.taalId,
        loopId: preset.loopId ?? getDefaultLoop(presetTaal).id,
        tempo: preset.tempo,
        tonic: preset.tonic ?? current.tonic,
      }))
    })
  }

  const currentBol = currentPosition.beat.label
  const thekaPreview = selectedLoop.beats.map((beat) => beat.label).join(' · ')
  const khaliLabel =
    selectedTaal.khali.length > 0 ? selectedTaal.khali.join(', ') : 'None'
  const tapLoopPreview = tapLoopPattern ? formatTapLoopPreview(tapLoopPattern) : ''
  const tapLoopSummary =
    tapLoopState === 'capturing'
      ? `${tapLoopTapCount} ${tapLoopTapCount === 1 ? 'tap' : 'taps'} captured. Pause briefly or press Finish to lock the phrase.`
      : tapLoopPattern
        ? `${tapLoopPattern.tapCount} hits repeating across ${tapLoopPattern.beatCount} matras at ${tapLoopPattern.bpm} BPM.`
        : 'Tap the phrase you want to double over the current cycle. A short pause turns it into a repeating overlay.'
  const tapLoopLabel =
    tapLoopState === 'capturing'
      ? 'Capturing'
      : tapLoopPattern
        ? 'Loop Ready'
        : 'Idle'

  return (
    <div className="app-shell">
      <header className="hero-panel">
        <div className="hero-panel__copy">
          <p className="hero-panel__eyebrow">SurSaath</p>
          <h1>Tanpura and taal support for focused riyaaz.</h1>
          <p className="hero-panel__lead">
            Static, browser-based practice support with a warm tanpura layer,
            usable taal playback, tap-loop capture, and live cycle tracking.
          </p>
        </div>

        <div className="hero-panel__status">
          <div className="hero-metric">
            <span>Pitch</span>
            <strong>{settings.tonic}</strong>
          </div>
          <div className="hero-metric">
            <span>Tempo</span>
            <strong>{settings.tempo} BPM</strong>
          </div>
          <div className="hero-metric hero-metric--wide">
            <span>Now sounding</span>
            <strong>
              {selectedTaal.name} · {selectedLoop.label} · Matra {currentPosition.matra} ·{' '}
              {currentBol}
            </strong>
          </div>
          <div className="hero-badges">
            <span className="hero-badge">
              {audioReady ? 'Audio ready' : 'Press Start to unlock audio'}
            </span>
            <span className="hero-badge hero-badge--secondary">
              {playbackState}
            </span>
          </div>
        </div>
      </header>

      <main className="app-grid">
        <div className="app-grid__primary">
          <CycleTracker
            taal={selectedTaal}
            loop={selectedLoop}
            currentMatra={currentPosition.matra}
            cycle={currentPosition.cycle}
            playbackState={playbackState}
          />

          <SectionCard title="Transport" subtitle="Playback and tempo">
            <div className="transport-grid">
              <div className="transport-controls">
                <button
                  className="transport-button transport-button--primary"
                  onClick={() => void handleStart()}
                  disabled={playbackState === 'playing'}
                >
                  Start
                </button>
                <button
                  onClick={handlePause}
                  disabled={playbackState !== 'playing'}
                >
                  Pause
                </button>
                <button
                  onClick={handleStop}
                  disabled={playbackState === 'stopped'}
                >
                  Stop
                </button>
                <button onClick={handleReset}>Reset</button>
                <button
                  onClick={handleClearTapLoop}
                  disabled={!tapLoopPattern && tapLoopState !== 'capturing'}
                >
                  Clear tap loop
                </button>
              </div>

              <div className="tempo-panel">
                <div className="tempo-panel__display">
                  <span>Current BPM</span>
                  <strong>{settings.tempo}</strong>
                  <small>
                    Tempo slider stays available, but tap-loop capture can now
                    set the loop pace from the phrase you play.
                  </small>
                </div>
                <SliderField
                  id="tempo"
                  label="Tempo"
                  min={MIN_TEMPO}
                  max={MAX_TEMPO}
                  value={settings.tempo}
                  valueLabel={`${settings.tempo} BPM`}
                  onChange={(value) =>
                    updateSettings((current) => ({
                      ...current,
                      tempo: clampTempo(value),
                    }))
                  }
                />

                <div className="tap-loop-panel">
                  <div className="tap-loop-panel__header">
                    <strong>Tap Loop</strong>
                    <span data-state={tapLoopState}>{tapLoopLabel}</span>
                  </div>
                  <p className="tap-loop-panel__summary">{tapLoopSummary}</p>

                  <div className="tap-loop-panel__buttons">
                    <button
                      className={[
                        'transport-button',
                        'transport-button--tap',
                        tapLoopState === 'capturing'
                          ? 'transport-button--armed'
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => void handleTapLoopTap()}
                    >
                      {tapLoopState === 'capturing'
                        ? 'Tap Phrase'
                        : tapLoopPattern
                          ? 'Re-record Loop'
                          : 'Tap Loop'}
                    </button>
                    <button
                      onClick={handleFinishTapLoop}
                      disabled={tapLoopState !== 'capturing'}
                    >
                      Finish
                    </button>
                  </div>

                  {tapLoopPattern ? (
                    <div className="tap-loop-preview">
                      Positions: {tapLoopPreview}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Tanpura"
            subtitle="Tonic and drone blend"
            aside={<div className="selected-note">{settings.tonic}</div>}
          >
            <div className="note-grid" role="radiogroup" aria-label="Select tonic">
              {TONICS.map((note) => (
                <button
                  key={note}
                  className={
                    note === settings.tonic
                      ? 'note-button note-button--active'
                      : 'note-button'
                  }
                  aria-pressed={note === settings.tonic}
                  onClick={() =>
                    updateSettings((current) => ({
                      ...current,
                      tonic: note,
                    }))
                  }
                >
                  {note}
                </button>
              ))}
            </div>

            <SliderField
              id="tanpura-volume"
              label="Tanpura volume"
              min={0}
              max={100}
              value={Math.round(settings.tanpuraVolume * 100)}
              valueLabel={`${Math.round(settings.tanpuraVolume * 100)}%`}
              onChange={(value) =>
                updateSettings((current) => ({
                  ...current,
                  tanpuraVolume: clampUnitLevel(value / 100),
                }))
              }
            />
          </SectionCard>

          <SectionCard
            title="Taal Box"
            subtitle="Cycle, style, and loop selection"
          >
            <div className="taal-grid">
              <label className="select-field" htmlFor="taal-select">
                <span>Choose taal</span>
                <select
                  id="taal-select"
                  value={settings.taalId}
                  onChange={(event) => {
                    const nextTaal = TAAL_BY_ID[event.target.value]
                    clearTapLoopOverlay()

                    updateSettings((current) => ({
                      ...current,
                      taalId: nextTaal.id,
                      loopId: getDefaultLoop(nextTaal).id,
                    }))
                  }}
                >
                  {TAALS.map((taal) => (
                    <option key={taal.id} value={taal.id}>
                      {taal.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="select-field" htmlFor="loop-select">
                <span>Loop / style</span>
                <select
                  id="loop-select"
                  value={selectedLoop.id}
                  onChange={(event) => {
                    clearTapLoopOverlay()
                    updateSettings((current) => ({
                      ...current,
                      loopId: event.target.value,
                    }))
                  }}
                >
                  {selectedTaal.loops.map((loop) => (
                    <option key={`${selectedTaal.id}-${loop.id}`} value={loop.id}>
                      {loop.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="taal-summary">
                <span>Total matras: {selectedTaal.totalMatras}</span>
                <span>Vibhag: {selectedTaal.vibhags.join(' + ')}</span>
                <span>Sam: {selectedTaal.sam}</span>
                <span>Khali: {khaliLabel}</span>
                <span>Loop: {selectedLoop.label}</span>
              </div>
            </div>

            <p className="support-copy">{selectedTaal.summary}</p>
            <p className="support-copy support-copy--tight">{selectedLoop.summary}</p>
            <div className="theka-strip">{thekaPreview}</div>

            <SliderField
              id="percussion-volume"
              label="Percussion volume"
              min={0}
              max={100}
              value={Math.round(settings.percussionVolume * 100)}
              valueLabel={`${Math.round(settings.percussionVolume * 100)}%`}
              onChange={(value) =>
                updateSettings((current) => ({
                  ...current,
                  percussionVolume: clampUnitLevel(value / 100),
                }))
              }
            />
          </SectionCard>
        </div>

        <div className="app-grid__secondary">
          <SectionCard title="Presets" subtitle="Quick starting points">
            <div className="preset-list">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className="preset-button"
                  onClick={() => applyPreset(preset.id)}
                >
                  <strong>{preset.label}</strong>
                  <span>{preset.subtitle}</span>
                </button>
              ))}
            </div>
          </SectionCard>

          <HelpPanel />
        </div>
      </main>
    </div>
  )
}

export default App
