import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useStore, MC_VERSIONS, MCVersion } from '../store/useStore'
import logo from '../assets/logo.png'

export default function Home() {
    const {
        selectedVersion, setSelectedVersion,
        username, ram, javaPath, jvmArgs, clientDir,
        launchStatus, setLaunchStatus,
        downloadProgress, setDownloadProgress,
        launchError, setLaunchError,
        showToast,
    } = useStore()

    const [isLaunching, setIsLaunching] = useState(false)

    const handleLaunch = async () => {
        if (isLaunching) return
        setIsLaunching(true)
        setLaunchError(null)
        setLaunchStatus('fetching')
        const { appendLog, clearLogs } = useStore.getState()
        clearLogs()
        appendLog('Starting launch sequence...')

        try {
            // Listen to progress events from Rust
            const unlistenProgress = await listen<{ file: string; current: number; total: number }>('download-progress', (event) => {
                const { file, current, total } = event.payload
                setDownloadProgress({
                    file,
                    current,
                    total,
                    percentage: total > 0 ? Math.round((current / total) * 100) : 0,
                })
            })

            // Listen to Minecraft logs
            await listen<string>('minecraft-log', (event) => {
                appendLog(event.payload)
            })

            setLaunchStatus('downloading')
            await invoke('prepare_and_launch', {
                version: selectedVersion,
                username,
                ramGb: ram,
                javaPath: javaPath || null,
                extraJvmArgs: jvmArgs || null,
                clientDir: clientDir || null,
            })

            unlistenProgress()
            // We keep the logs listener active even after return, 
            // but in a real app you might want to manage this better.

            setLaunchStatus('running')
            setDownloadProgress(null)
            showToast(`Minecraft ${selectedVersion} launched!`)
        } catch (e: any) {
            setLaunchError(String(e))
            setLaunchStatus('error')
            setDownloadProgress(null)
            appendLog(`[ERROR] ${String(e)}`)
        } finally {
            setIsLaunching(false)
        }
    }

    const statusLabel: Record<string, string> = {
        idle: 'Ready to launch',
        fetching: 'Fetching mod list...',
        downloading: 'Downloading mods...',
        installing_fabric: 'Installing Fabric...',
        launching: 'Starting Minecraft...',
        running: 'Game is running',
        error: 'Launch failed',
    }

    return (
        <div className="animate-in">
            {/* Header */}
            <div className="page-header">
                <div className="page-title">
                    Welcome to <span>Nano Client</span>
                </div>
                <div className="page-subtitle">
                    High-performance Fabric client — Select a version and launch
                </div>
            </div>

            {/* Launch section */}
            <div className="launch-section" style={{ marginBottom: '28px' }}>
                <div className="launch-logo-container">
                    <img src={logo} alt="Nano" />
                </div>
                <div className="btn-launch-info">
                    <div className="btn-launch-info-title">
                        {launchStatus === 'idle' ? `Minecraft ${selectedVersion}` : statusLabel[launchStatus]}
                    </div>
                    <div className="btn-launch-info-sub">
                        Fabric {MC_VERSIONS.find(v => v.version === selectedVersion)?.fabricLoader} ·{' '}
                        Java {MC_VERSIONS.find(v => v.version === selectedVersion)?.javaVersion} ·{' '}
                        {useStore.getState().ram}GB RAM
                    </div>
                    {launchError && (
                        <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 4 }}>
                            ⚠ {launchError}
                        </div>
                    )}
                </div>

                <button
                    id="btn-launch"
                    className="btn-launch"
                    onClick={handleLaunch}
                    disabled={isLaunching}
                >
                    {isLaunching ? (
                        <><span className="spinner" /> Launching...</>
                    ) : (
                        <>
                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
                            </svg>
                            LAUNCH
                        </>
                    )}
                </button>
            </div>

            {/* Launch progress overlay */}
            {(downloadProgress || isLaunching) && (
                <div className="progress-overlay">
                    <div className="progress-overlay-title">
                        {launchStatus === 'fetching' && 'Checking files...'}
                        {launchStatus === 'downloading' && 'Downloading assets'}
                        {launchStatus === 'installing_fabric' && 'Installing Fabric'}
                        {launchStatus === 'launching' && 'Launching Minecraft'}
                        {launchStatus === 'running' && 'Game is running'}
                    </div>
                    <div className="progress-overlay-pct">
                        {launchStatus === 'downloading' ? `${downloadProgress?.percentage || 0}%` : '...'}
                    </div>
                    <div className="progress-wrap">
                        <div
                            className={`progress-bar${launchStatus !== 'downloading' ? ' progress-bar-animated' : ''}`}
                            style={{
                                width: launchStatus === 'downloading'
                                    ? `${downloadProgress?.percentage || 0}%`
                                    : launchStatus === 'running' ? '100%' : '50%'
                            }}
                        />
                    </div>
                    <div className="progress-overlay-file">
                        {downloadProgress?.file || statusLabel[launchStatus]}
                    </div>
                </div>
            )}

            {/* Version selector */}
            <div className="section">
                <div className="section-title">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Select Version
                </div>
                <div className="versions-grid">
                    {MC_VERSIONS.map((vi) => (
                        <div
                            key={vi.version}
                            id={`version-card-${vi.version.replace(/\./g, '-')}`}
                            className={`version-card${selectedVersion === vi.version ? ' selected' : ''}`}
                            onClick={() => setSelectedVersion(vi.version as MCVersion)}
                        >
                            <div className="version-check">
                                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div className="version-label">Minecraft</div>
                            <div className="version-number">{vi.version}</div>
                            <div className="version-fabric">
                                <span className="badge badge-blue" style={{ fontSize: 9 }}>
                                    Fabric {vi.fabricLoader}
                                </span>
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                                Java {vi.javaVersion}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Quick stats dashboard */}
            <div className="section">
                <div className="section-title">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Client Dashboard
                </div>

                <div className="stats-card">
                    <div className="stat-item">
                        <div className="stat-info">
                            <div className="stat-icon">👤</div>
                            <div className="stat-label">System User</div>
                        </div>
                        <div className="stat-value">{useStore.getState().username || 'Not set'}</div>
                    </div>

                    <div className="stat-item">
                        <div className="stat-info">
                            <div className="stat-icon">🧠</div>
                            <div className="stat-label">RAM Allocation</div>
                        </div>
                        <div className="stat-value">
                            <span className="badge badge-blue">{useStore.getState().ram} GB</span>
                        </div>
                    </div>

                    <div className="stat-item">
                        <div className="stat-info">
                            <div className="stat-icon">📦</div>
                            <div className="stat-label">Installed Mods</div>
                        </div>
                        <div className="stat-value">40 mods</div>
                    </div>

                    <div className="stat-item">
                        <div className="stat-info">
                            <div className="stat-icon">📡</div>
                            <div className="stat-label">Available Versions</div>
                        </div>
                        <div className="stat-value">7 entries</div>
                    </div>

                    <div className="stat-item">
                        <div className="stat-info">
                            <div className="stat-icon">⚡</div>
                            <div className="stat-label">Launch Readiness</div>
                        </div>
                        <div className="stat-value">
                            <span className={`badge ${launchStatus === 'running' ? 'badge-green' : launchStatus === 'error' ? 'badge-red' : 'badge-yellow'}`}>
                                {statusLabel[launchStatus]}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
