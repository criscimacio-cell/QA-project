'use client'

import { Component, ReactNode, Suspense, lazy } from 'react'
import type { Application } from '@splinetool/runtime'

const Spline = lazy(() => import('@splinetool/react-spline'))

export type SplineApp = Application

interface SplineSceneProps {
  scene: string
  className?: string
  onLoad?: (app: SplineApp) => void
}

// This scene is purely decorative and loaded from an external, third-party
// CDN (prod.spline.design). Without a local error boundary, any failure to
// reach it — a blocked/offline network, an ad-blocker, a CDN outage — bubbled
// straight past <Suspense> into the app-wide ErrorBoundary, replacing the
// entire login screen with "Something went wrong" and no way to log in.
// A background image failing to load should never take down the login page.
class SplineErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: unknown) {
    console.error('SplineScene failed to load, hiding decorative scene:', error)
  }
  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

export function SplineScene({ scene, className, onLoad }: SplineSceneProps) {
  return (
    <SplineErrorBoundary>
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <Spline scene={scene} className={className} onLoad={onLoad} />
      </Suspense>
    </SplineErrorBoundary>
  )
}
