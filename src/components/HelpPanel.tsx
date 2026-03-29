import { SectionCard } from './SectionCard'

export function HelpPanel() {
  return (
    <SectionCard title="Guide" subtitle="Glossary and usage">
      <details className="help-panel" open>
        <summary>How to use SurSaath</summary>

        <div className="help-grid">
          <div>
            <strong>Taal</strong>
            <p>The full rhythmic cycle that repeats during practice.</p>
          </div>
          <div>
            <strong>Matra</strong>
            <p>One beat inside the cycle. The tracker highlights the current matra live.</p>
          </div>
          <div>
            <strong>Vibhag</strong>
            <p>A grouping of matras that helps you feel the structure instead of counting flat beats.</p>
          </div>
          <div>
            <strong>Sam</strong>
            <p>The first and most important point of arrival in the cycle.</p>
          </div>
          <div>
            <strong>Khali</strong>
            <p>A lighter or waved section that contrasts with the clapped vibhags.</p>
          </div>
          <div>
            <strong>Use</strong>
            <p>Choose your tonic and taal, press Start once to unlock audio, then adjust BPM as you practise.</p>
          </div>
        </div>
      </details>
    </SectionCard>
  )
}
