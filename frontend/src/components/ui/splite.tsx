'use client'

import { Suspense, lazy, Component, type ReactNode, type ErrorInfo } from 'react'
import type { Application } from '@splinetool/runtime'

const Spline = lazy(() => import('@splinetool/react-spline'))

export type SplineApp = Application

interface SplineSceneProps {
  scene: string
  className?: string
  onLoad?: (app: SplineApp) => void
}

class SplineErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(_: Error, __: ErrorInfo) {}
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

export function SplineScene({ scene, className, onLoad }: SplineSceneProps) {
  const placeholder = (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  return (
    <SplineErrorBoundary fallback={<div className={className} />}>
      <Suspense fallback={placeholder}>
        <Spline scene={scene} className={className} onLoad={onLoad} />
      </Suspense>
    </SplineErrorBoundary>
  )
}
