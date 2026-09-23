import { Component, type ReactNode } from 'react'

export interface RenderBoundaryProps {
  /** Shown in place of the children once they have failed to render. */
  fallback: ReactNode
  /**
   * Called once when the children fail to render.
   *
   * It receives nothing. A render error can carry whatever the failing component was holding,
   * which in this codebase may be a patient's own data, so the boundary reports that a failure
   * happened and never what it was. A caller that needs the error should write its own boundary
   * and take responsibility for where the error goes.
   */
  onError?: () => void
  children: ReactNode
}

/**
 * Keeps one failing subtree from unmounting the tree around it. React tears down to the nearest
 * boundary, so without one a single throwing child takes its siblings with it.
 *
 * It catches a throw from anything below it, including a render prop called by its own child.
 * React reports the caught error through its own path as well, so this is not a way to keep an
 * error out of the console.
 */
export class RenderBoundary extends Component<RenderBoundaryProps, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch() {
    this.props.onError?.()
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
