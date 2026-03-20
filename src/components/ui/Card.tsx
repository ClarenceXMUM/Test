import { useState, useRef, useEffect } from 'react'
import './Card.css'

interface CardProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

export function Card({ title, children, defaultOpen = false }: CardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [height, setHeight] = useState<number | undefined>(defaultOpen ? undefined : 0)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!contentRef.current) return
    if (open) {
      setHeight(contentRef.current.scrollHeight)
      // After transition, let it be auto so it can grow
      const timer = setTimeout(() => setHeight(undefined), 280)
      return () => clearTimeout(timer)
    } else {
      // Set to explicit height first so transition works from auto
      setHeight(contentRef.current.scrollHeight)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight(0))
      })
    }
  }, [open])

  return (
    <div className={`card ${open ? 'card--open' : ''}`}>
      <button className="card__header" onClick={() => setOpen(o => !o)}>
        <span className="card__title">{title}</span>
        <span className="card__chevron">{open ? '⌃' : '⌄'}</span>
      </button>
      <div
        ref={contentRef}
        className="card__body"
        style={{ maxHeight: height === undefined ? 'none' : `${height}px` }}
      >
        <div className="card__inner">{children}</div>
      </div>
    </div>
  )
}
