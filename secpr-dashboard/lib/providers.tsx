'use client'

import { AuthProvider } from './auth'
import { OrgProvider } from './org'
import { NotificationsProvider } from './notifications'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <OrgProvider>
        <NotificationsProvider>
          {children}
        </NotificationsProvider>
      </OrgProvider>
    </AuthProvider>
  )
}
