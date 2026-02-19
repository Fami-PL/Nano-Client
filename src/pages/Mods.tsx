import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useStore, ModInfo } from '../store/useStore'

const MOD_ICONS: Record<string, string> = {
    'sodium': '🔵', 'lithium': '🟣', 'iris': '🌈', 'ferritecore': '🟢',
    'immediatelyfast': '⚡', 'entityculling': '👁', 'krypton': '🌐',
    'c2me': '🔄', 'modmenu': '📋', 'fabric-api': '🧱', 'sodium-extra': '🔷',
    'reeses-sodium-options': '🎛', 'dynamic-fps': '📉', 'modernfix': '🔧',
    'spark': '🔥', 'cloth-config': '⚙', 'yacl': '⚙', 'zoomify': '🔍',
    'notalbenimations': '🎭', 'chat-heads': '💬', 'default': '📦',
}

function getIcon(name: string): string {
    const lower = name.toLowerCase().replace(/\s+/g, '-')
    for (const [key, icon] of Object.entries(MOD_ICONS)) {
        if (lower.includes(key)) return icon
    }
    return MOD_ICONS.default
}

const CATEGORY_LABELS: Record<string, string> = {
    performance: 'Performance',
    visual: 'Visual',
    utility: 'Utility',
    library: 'Library',
}

export default function Mods() {
    const {
        selectedVersion, mods, setMods, modsLoaded, setModsLoaded,
        disabledMods, toggleMod, modlistUrl, showToast,
    } = useStore()

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [filter, setFilter] = useState<string>('all')
    const [search, setSearch] = useState('')

    const fetchMods = async () => {
        setLoading(true)
        setError(null)
        try {
            const result = await invoke<ModInfo[]>('fetch_mods_for_version', {
                version: selectedVersion,
                url: modlistUrl,
            })
            setMods(result)
            setModsLoaded(true)
            showToast(`Loaded ${result.length} mods for ${selectedVersion}`)
        } catch (e: any) {
            setError(String(e))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!modsLoaded) fetchMods()
    }, [selectedVersion])

    const categories = ['all', 'performance', 'visual', 'utility', 'library']

    const filtered = mods.filter(mod => {
        const matchCat = filter === 'all' || mod.category === filter
        const matchSearch = mod.name.toLowerCase().includes(search.toLowerCase())
        return matchCat && matchSearch
    })

    const enabledCount = mods.filter(m => !disabledMods.has(m.id)).length

    return (
        <div className="animate-in">
            {/* Header */}
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div className="page-title">Mod <span>Manager</span></div>
                        <div className="page-subtitle">
                            {enabledCount}/{mods.length} mods enabled for Minecraft {selectedVersion}
                        </div>
                    </div>
                    <button
                        id="btn-refresh-mods"
                        className="btn btn-secondary"
                        onClick={fetchMods}
                        disabled={loading}
                    >
                        {loading ? <><span className="spinner" /> Loading...</> : (
                            <>
                                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                    <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}
                        width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        id="mods-search"
                        className="input"
                        style={{ paddingLeft: 32, width: '100%' }}
                        placeholder="Search mods..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                {/* Category filters */}
                <div style={{ display: 'flex', gap: 6 }}>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            id={`filter-${cat}`}
                            className={`btn ${filter === cat ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: 11, padding: '6px 12px', textTransform: 'capitalize' }}
                            onClick={() => setFilter(cat)}
                        >
                            {cat === 'all' ? `All (${mods.length})` : CATEGORY_LABELS[cat]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="card" style={{
                    borderColor: 'rgba(239,68,68,0.4)',
                    background: 'rgba(239,68,68,0.05)',
                    marginBottom: 20,
                    display: 'flex', gap: 12, alignItems: 'center',
                }}>
                    <span style={{ fontSize: 20 }}>⚠️</span>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--error)' }}>Failed to load mods</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{error}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                            Make sure your modlist URL is set correctly in Settings.
                        </div>
                    </div>
                </div>
            )}

            {/* Empty / loading state */}
            {loading && mods.length === 0 && (
                <div className="flex-center" style={{ height: 200, flexDirection: 'column', gap: 12 }}>
                    <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                    <div className="text-secondary text-sm">Fetching mods from GitHub...</div>
                </div>
            )}

            {/* Mods grid */}
            {!loading && mods.length === 0 && !error && (
                <div className="flex-center" style={{ height: 200, flexDirection: 'column', gap: 10 }}>
                    <span style={{ fontSize: 36 }}>📦</span>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>No mods loaded</div>
                    <div className="text-sm text-secondary">Click Refresh to load mods from your GitHub</div>
                </div>
            )}

            {filtered.length > 0 && (
                <div className="mods-grid">
                    {filtered.map(mod => {
                        const enabled = !disabledMods.has(mod.id)
                        return (
                            <div
                                key={mod.id}
                                id={`mod-card-${mod.id}`}
                                className={`mod-card${!enabled ? ' disabled' : ''}`}
                            >
                                <div className="mod-icon">{getIcon(mod.name)}</div>
                                <div className="mod-info">
                                    <div className="mod-name">{mod.name}</div>
                                    <div className="mod-category">{CATEGORY_LABELS[mod.category]}</div>
                                    <div className="mod-tags">
                                        {mod.required && <span className="mod-tag required">Required</span>}
                                        <span className={`mod-tag ${mod.category}`}>{mod.category}</span>
                                    </div>
                                </div>
                                <div
                                    id={`toggle-${mod.id}`}
                                    className={`toggle${enabled ? ' on' : ''}`}
                                    onClick={() => !mod.required && toggleMod(mod.id)}
                                    title={mod.required ? 'Required mod' : enabled ? 'Disable mod' : 'Enable mod'}
                                    style={{ cursor: mod.required ? 'not-allowed' : 'pointer', opacity: mod.required ? 0.7 : 1 }}
                                >
                                    <div className="toggle-thumb" />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
