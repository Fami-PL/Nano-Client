import { useStore } from '../store/useStore'
import { useEffect, useRef } from 'react'

export default function Logs() {
    const { logs, clearLogs, showToast } = useStore()
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [logs])

    const copyLogs = () => {
        navigator.clipboard.writeText(logs.join('\n'))
        showToast('Logs copied to clipboard!')
    }

    return (
        <div className="animate-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="page-header">
                <div className="page-title">
                    <span>Minecraft Logs</span>
                </div>
                <div className="page-subtitle">
                    Real-time output from the game process
                </div>
            </div>

            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', background: '#0a0a0c' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 16px',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--bg-secondary)'
                }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Console Output
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={copyLogs}>
                            Copy Logs
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={clearLogs}>
                            Clear
                        </button>
                    </div>
                </div>

                <div
                    ref={scrollRef}
                    className="log-container"
                >
                    {logs.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20%' }}>
                            No logs to display. Launch Minecraft to see output.
                        </div>
                    ) : (
                        logs.map((log, i) => (
                            <div key={i} className="log-entry">
                                <span className="log-time">[{new Date().toLocaleTimeString()}]</span>
                                <span className={`log-content${log.includes('[ERROR]') ? ' log-error' : ''}`}>
                                    {log}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
