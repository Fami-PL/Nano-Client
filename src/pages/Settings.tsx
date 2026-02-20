import { useStore } from '../store/useStore'
import { invoke } from '@tauri-apps/api/core'

export default function Settings() {
    const {
        ram, setRam,
        javaPath, setJavaPath,
        jvmArgs, setJvmArgs,
        clientDir, setClientDir,
        showToast,
    } = useStore()

    const handleSave = () => {
        showToast('Settings saved!')
    }

    const handleRepair = async (type: 'mods' | 'fabric' | 'java' | 'all') => {
        const confirmMsg = type === 'all'
            ? "WARNING: This will delete ALL Minecraft files, mods, and profiles. Are you sure?"
            : `Are you sure you want to reinstall ${type}? This will delete current ${type} files.`;

        if (!window.confirm(confirmMsg)) return;

        try {
            await invoke('repair_client', { repairType: type })
            showToast(`Repair successful: ${type} reset.`)
        } catch (e) {
            alert(`Repair failed: ${e}`)
        }
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
            </div>

            {/* Maintenance */}
            <div className="settings-group">
                <div className="settings-group-header">Maintenance & Repair</div>
                <div className="settings-desc" style={{ padding: '16px 20px 0' }}>
                    Troubleshoot issues by reinstalling core components or performing a full factory reset.
                </div>

                <div className="repair-grid" style={{ padding: '0 20px 20px' }}>
                    <div className="repair-card">
                        <div className="repair-card-header">
                            <div className="repair-card-icon">📦</div>
                            <div className="repair-card-title">Reinstall Mods</div>
                        </div>
                        <div className="repair-card-desc">Deletes all downloaded mods and caches to force a fresh sync.</div>
                        <button className="btn btn-secondary btn-repair" onClick={() => handleRepair('mods')}>Repair Mods</button>
                    </div>

                    <div className="repair-card">
                        <div className="repair-card-header">
                            <div className="repair-card-icon">🛠</div>
                            <div className="repair-card-title">Reinstall Fabric</div>
                        </div>
                        <div className="repair-card-desc">Resets the Fabric loader, libraries, and Minecraft core files.</div>
                        <button className="btn btn-secondary btn-repair" onClick={() => handleRepair('fabric')}>Repair Fabric</button>
                    </div>

                    <div className="repair-card">
                        <div className="repair-card-header">
                            <div className="repair-card-icon">☕</div>
                            <div className="repair-card-title">Reinstall Java</div>
                        </div>
                        <div className="repair-card-desc">Deletes the internal Java runtime to trigger a fresh download.</div>
                        <button className="btn btn-secondary btn-repair" onClick={() => handleRepair('java')}>Repair Java</button>
                    </div>

                    <div className="repair-card danger-zone-card">
                        <div className="repair-card-header">
                            <div className="repair-card-icon">⚠</div>
                            <div className="repair-card-title" style={{ color: 'var(--error)' }}>Factory Reset</div>
                        </div>
                        <div className="repair-card-desc">Wipes EVERYTHING (profiles, assets, mods). Used for extreme cases.</div>
                        <button className="btn btn-danger btn-repair" onClick={() => handleRepair('all')}>Reset Everything</button>
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
                    <div style={{ color: 'var(--text-accent)', marginBottom: 4 }}># For Java 21+ (MC 1.21+)</div>
                    -XX:+UnlockExperimentalVMOptions -XX:+UseZGC -XX:+ZGenerational -XX:+AlwaysPreTouch -Xss4M
                    <div style={{ color: 'var(--text-accent)', marginTop: 8, marginBottom: 4 }}># For Java 17 (MC 1.20)</div>
                    -XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:+AlwaysPreTouch -Xss4M
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
