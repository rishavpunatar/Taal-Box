import { getLoopById, TAAL_BY_ID } from '../data/taals'
import { TONICS, type AppSettings, type Tonic } from '../types/music'
import { clampTempo, clampUnitLevel } from './music'

const STORAGE_KEY = 'sursaath-settings-v2'

export const DEFAULT_SETTINGS: AppSettings = {
  taalId: 'teentaal',
  loopId: 'standard',
  tonic: 'C',
  tempo: 84,
  tanpuraVolume: 0.72,
  percussionVolume: 0.76,
  tanpuraEnabled: true,
  percussionEnabled: true,
}

function isTonic(value: unknown): value is Tonic {
  return typeof value === 'string' && TONICS.includes(value as Tonic)
}

export function loadSettings() {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return DEFAULT_SETTINGS
    }

    const parsed = JSON.parse(raw) as Partial<AppSettings>
    const taalId =
      typeof parsed.taalId === 'string' && parsed.taalId in TAAL_BY_ID
        ? parsed.taalId
        : DEFAULT_SETTINGS.taalId
    const loopId = getLoopById(
      TAAL_BY_ID[taalId],
      typeof parsed.loopId === 'string' ? parsed.loopId : undefined,
    ).id

    return {
      taalId,
      loopId,
      tonic: isTonic(parsed.tonic) ? parsed.tonic : DEFAULT_SETTINGS.tonic,
      tempo:
        typeof parsed.tempo === 'number'
          ? clampTempo(parsed.tempo)
          : DEFAULT_SETTINGS.tempo,
      tanpuraVolume:
        typeof parsed.tanpuraVolume === 'number'
          ? clampUnitLevel(parsed.tanpuraVolume)
          : DEFAULT_SETTINGS.tanpuraVolume,
      percussionVolume:
        typeof parsed.percussionVolume === 'number'
          ? clampUnitLevel(parsed.percussionVolume)
          : DEFAULT_SETTINGS.percussionVolume,
      tanpuraEnabled:
        typeof parsed.tanpuraEnabled === 'boolean'
          ? parsed.tanpuraEnabled
          : DEFAULT_SETTINGS.tanpuraEnabled,
      percussionEnabled:
        typeof parsed.percussionEnabled === 'boolean'
          ? parsed.percussionEnabled
          : DEFAULT_SETTINGS.percussionEnabled,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: AppSettings) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
