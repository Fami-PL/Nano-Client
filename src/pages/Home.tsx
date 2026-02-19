import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useStore, MC_VERSIONS, MCVersion } from '../store/useStore'

export default function Home() {
    const {
        selectedVersion, setSelectedVersion,
        username, ram, javaPath, jvmArgs, modlistUrl, clientDir,
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

        try {
            // Listen to progress events from Rust
            const unlisten = await listen<{ file: string; current: number; total: number }>('download-progress', (event) => {
                const { file, current, total } = event.payload
                setDownloadProgress({
                    file,
                    current,
                    total,
                    percentage: total > 0 ? Math.round((current / total) * 100) : 0,
                })
            })

            setLaunchStatus('downloading')
            await invoke('prepare_and_launch', {
                version: selectedVersion,
                username,
                ramGb: ram,
                javaPath: javaPath || null,
                extraJvmArgs: jvmArgs || null,
                modlistUrl,
                clientDir: clientDir || null,
            })

            unlisten()
            setLaunchStatus('running')
            setDownloadProgress(null)
            showToast(`Minecraft ${selectedVersion} launched!`)
        } catch (e: any) {
            setLaunchError(String(e))
            setLaunchStatus('error')
            setDownloadProgress(null)
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
                <div>
                    <div style={{
                        width: 48, height: 48,
                        background: 'var(--gradient)',
                        borderRadius: 'var(--radius-lg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22,
                        boxShadow: 'var(--shadow-blue)',
                    }}>⚡</div>
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

            {/* Download progress */}
            {downloadProgress && (
                <div className="progress-overlay">
                    <div className="progress-overlay-title">Downloading</div>
                    <div className="progress-overlay-pct">{downloadProgress.percentage}%</div>
                    <div className="progress-wrap">
                        <div className="progress-bar" style={{ width: `${downloadProgress.percentage}%` }} />
                    </div>
                    <div className="progress-overlay-file">{downloadProgress.file}</div>
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

            {/* Quick stats */}
            <div className="section">
                <div className="section-title">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Client Info
                </div>
                <div className="card" style={{ maxWidth: 480 }}>
                    <div className="stat-row">
                        <span className="stat-label">Player</span>
                        <span className="stat-value">{useStore.getState().username || 'Not set'}</span>
                    </div>
                    <div className="stat-row">
                        <span className="stat-label">RAM Allocation</span>
                        <span className="stat-value">
                            <span className="badge badge-blue">{useStore.getState().ram}GB</span>
                        </span>
                    </div>
                    <div className="stat-row">
                        <span className="stat-label">Mod Count</span>
                        <span className="stat-value">40 mods</span>
                    </div>
                    <div className="stat-row">
                        <span className="stat-label">Supported Versions</span>
                        <span className="stat-value">7 versions</span>
                    </div>
                    <div className="stat-row">
                        <span className="stat-label">Status</span>
                        <span className="stat-value">
                            <span className={`badge ${launchStatus === 'running' ? 'badge-green' : launchStatus === 'error' ? 'badge-red' : 'badge-yellow'}`}>
                                {statusLabel[launchStatus]}
                            </span>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
