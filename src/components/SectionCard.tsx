import type { PropsWithChildren, ReactNode } from 'react'

interface SectionCardProps extends PropsWithChildren {
  title: string
  subtitle?: string
  aside?: ReactNode
  className?: string
}

export function SectionCard({
  title,
  subtitle,
  aside,
  className,
  children,
}: SectionCardProps) {
  return (
    <section className={`section-card${className ? ` ${className}` : ''}`}>
      <div className="section-card__header">
        <div>
          <p className="section-card__eyebrow">{title}</p>
          {subtitle ? <h2>{subtitle}</h2> : null}
        </div>
        {aside ? <div className="section-card__aside">{aside}</div> : null}
      </div>
      {children}
    </section>
  )
}
