import { getVibhagStarts } from '../lib/music'
import type { PlaybackState, TaalDefinition } from '../types/music'
import { SectionCard } from './SectionCard'

interface CycleTrackerProps {
  taal: TaalDefinition
  currentMatra: number
  cycle: number
  playbackState: PlaybackState
}

export function CycleTracker({
  taal,
  currentMatra,
  cycle,
  playbackState,
}: CycleTrackerProps) {
  const vibhagStarts = getVibhagStarts(taal)

  return (
    <SectionCard
      title="Cycle"
      subtitle="Live matra tracker"
      aside={
        <div className="cycle-aside">
          <span className="status-dot" data-state={playbackState} />
          <span>{playbackState === 'playing' ? 'Running' : playbackState}</span>
        </div>
      }
      className="cycle-card"
    >
      <div className="cycle-summary">
        <div>
          <span className="stat-label">Current matra</span>
          <strong>{currentMatra}</strong>
        </div>
        <div>
          <span className="stat-label">Cycle</span>
          <strong>{cycle}</strong>
        </div>
        <div>
          <span className="stat-label">Vibhag</span>
          <strong>{taal.vibhags.join(' + ')}</strong>
        </div>
      </div>

      <div className="cycle-grid">
        {taal.vibhags.map((size, vibhagIndex) => {
          const start = vibhagStarts[vibhagIndex]
          const beats = Array.from({ length: size }, (_, index) => start + index)
          const label = taal.khali.includes(start)
            ? 'Khali'
            : start === taal.sam
              ? 'Sam'
              : `Vibhag ${vibhagIndex + 1}`

          return (
            <div className="vibhag-card" key={`${taal.id}-${start}`}>
              <div className="vibhag-card__header">
                <strong>{label}</strong>
                <span>{beats.join(' • ')}</span>
              </div>

              <div className="vibhag-card__beats">
                {beats.map((matra) => {
                  const beat = taal.theka[matra - 1]
                  const isActive = matra === currentMatra
                  const isSam = matra === taal.sam
                  const isKhali = taal.khali.includes(matra)

                  return (
                    <div
                      key={`${taal.id}-${matra}`}
                      className={[
                        'beat-chip',
                        isActive ? 'beat-chip--active' : '',
                        isSam ? 'beat-chip--sam' : '',
                        isKhali ? 'beat-chip--khali' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <span className="beat-chip__number">{matra}</span>
                      <span className="beat-chip__bol">{beat.bol}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}
