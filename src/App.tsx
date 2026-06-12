import {
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
  TAAL_BY_ID,
  TAALS,
} from './data/taals'
import { SurSaathAudioEngine } from './lib/audioEngine'
import { clampTempo, clampUnitLevel, MAX_TEMPO, MIN_TEMPO } from './lib/music'
import { loadSettings, saveSettings } from './lib/storage'
import {
  TONICS,
  type AppSettings,
  type CyclePosition,
  type PlaybackState,
} from './types/music'

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

  const audioEngineRef = useRef<SurSaathAudioEngine | null>(null)

  const updateSettings = (updater: (current: AppSettings) => AppSettings) => {
    setSettings((current) => updater(current))
  }

  const handleCyclePosition = useEffectEvent((position: CyclePosition) => {
    setCurrentPosition(position)
  })

  useEffect(() => {
    const engine = new SurSaathAudioEngine(
      initialEngineState.taal,
      initialEngineState.loop,
      initialEngineState.tonic,
    )
    engine.setOnCyclePosition(handleCyclePosition)
    audioEngineRef.current = engine
    void engine.prime()

    return () => {
      engine.dispose()
      audioEngineRef.current = null
    }
  }, [initialEngineState])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

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
    audioEngineRef.current?.setTanpuraEnabled(settings.tanpuraEnabled)
  }, [settings.tanpuraEnabled])

  useEffect(() => {
    audioEngineRef.current?.setPercussionEnabled(settings.percussionEnabled)
  }, [settings.percussionEnabled])

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
  }

  const handleReset = () => {
    audioEngineRef.current?.reset()
    resetPositionView()
  }

  const currentBol = currentPosition.beat.label
  const thekaPreview = selectedLoop.beats.map((beat) => beat.label).join(' · ')
  const khaliLabel =
    selectedTaal.khali.length > 0 ? selectedTaal.khali.join(', ') : 'None'

  return (
    <div className="app-shell">
      <header className="hero-panel">
        <div className="hero-panel__copy">
          <p className="hero-panel__eyebrow">SurSaath</p>
          <h1>Tanpura and taal support for focused riyaaz.</h1>
          <p className="hero-panel__lead">
            Static, browser-based practice support with a warm tanpura layer,
            usable taal playback, and live cycle tracking.
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
              </div>

              <div className="tempo-panel">
                <div className="tempo-panel__display">
                  <span>Current BPM</span>
                  <strong>{settings.tempo}</strong>
                  <small>Adjust tempo live during playback.</small>
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
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Tanpura"
            subtitle="Tonic and drone blend"
            aside={<div className="selected-note">{settings.tonic}</div>}
          >
            <div className="layer-toggle-row">
              <button
                className={
                  settings.tanpuraEnabled
                    ? 'layer-toggle layer-toggle--on'
                    : 'layer-toggle'
                }
                aria-pressed={settings.tanpuraEnabled}
                onClick={() =>
                  updateSettings((current) => ({
                    ...current,
                    tanpuraEnabled: !current.tanpuraEnabled,
                  }))
                }
              >
                <span className="layer-toggle__dot" aria-hidden="true" />
                {settings.tanpuraEnabled ? 'Tanpura on' : 'Tanpura off'}
              </button>
              <p className="layer-toggle-hint">
                Switch the drone off to practise with tabla alone.
              </p>
            </div>

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
            <div className="layer-toggle-row">
              <button
                className={
                  settings.percussionEnabled
                    ? 'layer-toggle layer-toggle--on'
                    : 'layer-toggle'
                }
                aria-pressed={settings.percussionEnabled}
                onClick={() =>
                  updateSettings((current) => ({
                    ...current,
                    percussionEnabled: !current.percussionEnabled,
                  }))
                }
              >
                <span className="layer-toggle__dot" aria-hidden="true" />
                {settings.percussionEnabled ? 'Tabla on' : 'Tabla off'}
              </button>
              <p className="layer-toggle-hint">
                Switch the tabla off to sing over the drone — the cycle tracker
                keeps counting.
              </p>
            </div>

            <div className="taal-grid">
              <label className="select-field" htmlFor="taal-select">
                <span>Choose taal</span>
                <select
                  id="taal-select"
                  value={settings.taalId}
                  onChange={(event) => {
                    const nextTaal = TAAL_BY_ID[event.target.value]

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
            {selectedLoop.suggestedTempo !== undefined &&
            selectedLoop.suggestedTempo !== settings.tempo ? (
              <button
                className="tempo-hint"
                onClick={() =>
                  updateSettings((current) => ({
                    ...current,
                    tempo: clampTempo(selectedLoop.suggestedTempo ?? current.tempo),
                  }))
                }
              >
                Set recorded feel · {selectedLoop.suggestedTempo} BPM
              </button>
            ) : null}
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
          <HelpPanel />
        </div>
      </main>
    </div>
  )
}

export default App
