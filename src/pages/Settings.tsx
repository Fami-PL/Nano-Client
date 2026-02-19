import { useStore } from '../store/useStore'

export default function Settings() {
    const {
        username, setUsername,
        ram, setRam,
        javaPath, setJavaPath,
        jvmArgs, setJvmArgs,
        modlistUrl, setModlistUrl,
        clientDir, setClientDir,
        showToast,
    } = useStore()

    const handleSave = () => {
        showToast('Settings saved!')
    }

    return (
        <div className="animate-in">
            {/* Header */}
            <div className="page-header">
                <div className="page-title">
                    <span>Settings</span>
                </div>
                <div className="page-subtitle">
                    Configure your Nano Client launch preferences
                </div>
            </div>

            {/* Profile */}
            <div className="settings-group">
                <div className="settings-group-header">Profile</div>

                <div className="settings-item">
                    <div className="settings-item-info">
                        <div className="settings-label">Username</div>
                        <div className="settings-desc">Your Minecraft display name (offline mode)</div>
                    </div>
                    <input
                        id="input-username"
                        className="input"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="Player"
                        maxLength={16}
                    />
                </div>
            </div>

            {/* Performance */}
            <div className="settings-group">
                <div className="settings-group-header">Performance</div>

                <div className="settings-item">
                    <div className="settings-item-info">
                        <div className="settings-label">RAM Allocation</div>
                        <div className="settings-desc">Memory allocated to Minecraft (GB). Recommended: 4–8GB</div>
                    </div>
                    <div className="slider-wrap">
                        <input
                            id="slider-ram"
                            type="range"
                            className="slider"
                            min={1}
                            max={16}
                            step={1}
                            value={ram}
                            onChange={e => setRam(Number(e.target.value))}
                        />
                        <span className="slider-value">{ram}GB</span>
                    </div>
                </div>

                <div className="settings-item">
                    <div className="settings-item-info">
                        <div className="settings-label">Extra JVM Arguments</div>
                        <div className="settings-desc">
                            Custom JVM flags appended to launch args.{' '}
                            <span style={{ color: 'var(--text-muted)' }}>
                                e.g. -XX:+UseZGC
                            </span>
                        </div>
                    </div>
                    <input
                        id="input-jvm-args"
                        className="input"
                        value={jvmArgs}
                        onChange={e => setJvmArgs(e.target.value)}
                        placeholder="-XX:+UseZGC"
                    />
                </div>
            </div>

            {/* Java */}
            <div className="settings-group">
                <div className="settings-group-header">Java</div>

                <div className="settings-item">
                    <div className="settings-item-info">
                        <div className="settings-label">Java Executable Path</div>
                        <div className="settings-desc">
                            Path to the java binary. Leave empty to auto-detect.{' '}
                            <span style={{ color: 'var(--text-muted)' }}>/usr/bin/java</span>
                        </div>
                    </div>
                    <input
                        id="input-java-path"
                        className="input"
                        value={javaPath}
                        onChange={e => setJavaPath(e.target.value)}
                        placeholder="Auto-detect"
                    />
                </div>
            </div>

            {/* Client */}
            <div className="settings-group">
                <div className="settings-group-header">Client</div>

                <div className="settings-item">
                    <div className="settings-item-info">
                        <div className="settings-label">Client Directory</div>
                        <div className="settings-desc">
                            Where mods and Minecraft data are stored. Default:{' '}
                            <span style={{ color: 'var(--text-muted)' }}>~/.nanoclient</span>
                        </div>
                    </div>
                    <input
                        id="input-client-dir"
                        className="input"
                        value={clientDir}
                        onChange={e => setClientDir(e.target.value)}
                        placeholder="~/.nanoclient"
                    />
                </div>

                <div className="settings-item">
                    <div style={{ flex: 1 }}>
                        <div className="settings-label">Mod List URL</div>
                        <div className="settings-desc" style={{ marginTop: 4 }}>
                            GitHub raw URL to your <code style={{ background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>modlist.json</code> file
                        </div>
                        <input
                            id="input-modlist-url"
                            className="input input-full"
                            style={{ marginTop: 10, width: '100%' }}
                            value={modlistUrl}
                            onChange={e => setModlistUrl(e.target.value)}
                            placeholder="https://raw.githubusercontent.com/you/nano-client-mods/main/modlist.json"
                        />
                    </div>
                </div>
            </div>

            {/* JVM recommended tips */}
            <div className="card card-accent" style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-accent)', marginBottom: 10 }}>
                    💡 Recommended JVM Args for FPS
                </div>
                <div style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    fontFamily: 'monospace',
                    background: 'rgba(0,0,0,0.3)',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    lineHeight: 1.7,
                    wordBreak: 'break-all',
                }}>
                    -XX:+UnlockExperimentalVMOptions -XX:+UseZGC -XX:+ZGenerational
                    -XX:+AlwaysPreTouch -XX:+DisableExplicitGC -Xss4M
                </div>
            </div>

            {/* Save button */}
            <button
                id="btn-save-settings"
                className="btn btn-primary"
                onClick={handleSave}
                style={{ fontSize: 14, padding: '10px 28px' }}
            >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Save Settings
            </button>
        </div>
    )
}
