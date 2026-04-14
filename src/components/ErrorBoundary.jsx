import { Component } from 'react'
import { Link } from 'react-router-dom'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-[#FF3D00]/10 border border-[#FF3D00]/20 flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl">!</span>
            </div>
            <h2 className="text-xl font-heading font-bold text-white mb-3">Something went wrong</h2>
            <p className="text-sm font-body text-white/50 mb-6 leading-relaxed">
              This page encountered an error while rendering. This is usually caused by unexpected data.
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-5 py-2.5 rounded-lg bg-[#00BFFF]/10 text-[#00BFFF] border border-[#00BFFF]/20 text-sm font-mono font-semibold hover:bg-[#00BFFF]/20 transition-all duration-150"
              >
                Try again
              </button>
              <Link
                to="/"
                className="px-5 py-2.5 rounded-lg bg-white/5 text-white/70 border border-white/10 text-sm font-mono font-semibold hover:bg-white/10 transition-all duration-150"
              >
                Go to Dashboard
              </Link>
            </div>
            {this.state.error && (
              <pre className="mt-6 p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] text-xs font-mono text-white/30 text-left overflow-auto max-h-32">
                {this.state.error.toString()}
              </pre>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
