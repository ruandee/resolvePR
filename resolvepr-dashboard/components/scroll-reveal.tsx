'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

export function ScrollReveal({ children, className, id }: { children: ReactNode; className: string; id?: string }) {
  const sectionRef = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const section = sectionRef.current
    if (!section || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { threshold: 0.12 })

    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return <section ref={sectionRef} id={id} className={className + ' scroll-reveal' + (visible ? ' is-visible' : '')}>{children}</section>
}
