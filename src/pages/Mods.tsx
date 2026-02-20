import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useStore, ModInfo } from '../store/useStore'

const MOD_ICONS: Record<string, string> = {
    'sodium': '🔵', 'lithium': '🟣', 'iris': '🌈', 'ferritecore': '🟢',
    'immediatelyfast': '⚡', 'entityculling': '👁', 'krypton': '🌐',
    'starlight': '✨', 'c2me': '🔄', 'modmenu': '📋', 'fabric-api': '🧱',
    'sodium-extra': '🔷', 'reeses-sodium-options': '🎛', 'dynamic-fps': '📉',
    'modernfix': '🔧', 'spark': '🔥', 'cloth-config': '⚙', 'yacl': '⚙',
    'zoomify': '🔍', 'notalbenimations': '🎭', 'chat-heads': '💬',
    'clumps': '💎', 'appleskin': '🍎', 'continuity': '🔗', 'indium': '💠',
    'default': '📦',
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

export interface ModrinthMod {
    project_id: string
    title: string
    description: string
    icon_url: string | null
    author: string
    categories: string[]
    downloads?: number
}

interface ModrinthResponse {
    hits: ModrinthMod[]
    total_hits: number
    offset: number
    limit: number
}

export default function Mods() {
    const {
        selectedVersion, mods, setMods, setModsLoaded,
        disabledMods, toggleMod, showToast, clientDir
    } = useStore()

    const [loading, setLoading] = useState(false)
    const [view, setView] = useState<'manage' | 'add'>('manage')
    const [error, setError] = useState<string | null>(null)
    const [filter, setFilter] = useState<string>('all')
    const [search, setSearch] = useState('')

    // Modrinth state
    const [mrSearch, setMrSearch] = useState('')
    const [mrResults, setMrResults] = useState<ModrinthMod[]>([])
    const [mrLoading, setMrLoading] = useState(false)
    const [mrOffset, setMrOffset] = useState(0)
    const [mrTotal, setMrTotal] = useState(0)
    const [mrSort, setMrSort] = useState('downloads')
    const [installingId, setInstallingId] = useState<string | null>(null)

    const MODS_PER_PAGE = 20

    const fetchMods = async () => {
        setLoading(true)
        setError(null)
        try {
            const result = await invoke<ModInfo[]>('fetch_mods_for_version', {
                version: selectedVersion,
            })
            setMods(result)
            setModsLoaded(true)
        } catch (e: any) {
            setError(String(e))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchMods()
    }, [selectedVersion])

    // Fetch popular mods when entering 'add' view or changing sort/page
    useEffect(() => {
        if (view === 'add') {
            handleMrSearch(mrOffset)
        }
    }, [view, mrSort, mrOffset])

    const handleMrSearch = async (offset = 0) => {
        setMrLoading(true)
        try {
            const data = await invoke<ModrinthResponse>('search_modrinth', {
                query: mrSearch,
                mcVersion: selectedVersion,
                offset,
                limit: MODS_PER_PAGE,
                index: mrSort
            })
            setMrResults(data.hits)
            setMrTotal(data.total_hits)
            setMrOffset(offset)
        } catch (e) {
            showToast('Modrinth search failed')
        } finally {
            setMrLoading(false)
        }
    }

    const installMod = async (mod: ModrinthMod) => {
        setInstallingId(mod.project_id)
        try {
            await invoke('install_modrinth_mod', {
                projectId: mod.project_id,
                mcVersion: selectedVersion,
                customDir: clientDir
            })
            showToast(`Installed ${mod.title}!`)
            fetchMods() // Refresh local list
        } catch (e: any) {
            showToast(`Install failed: ${e}`)
        } finally {
            setInstallingId(null)
        }
    }

    const categories = ['all', 'performance', 'visual', 'utility', 'library']

    const filtered = mods.filter(mod => {
        const matchCat = filter === 'all' || mod.category === filter
        const matchSearch = mod.name.toLowerCase().includes(search.toLowerCase())
        return matchCat && matchSearch
    })

    const enabledCount = mods.filter(m => !disabledMods.has(m.id)).length

    const totalPages = Math.ceil(mrTotal / MODS_PER_PAGE)
    const currentPage = Math.floor(mrOffset / MODS_PER_PAGE) + 1

    const handleShowOnModrinth = (name: string) => {
        setView('add')
        setMrSearch(name)
        // We'll let the existing useEffect in the 'add' view handle the search
        // but since we want to force it now:
        setTimeout(() => handleMrSearch(0), 10)
    }

    return (
        <div className="animate-in">
            {/* Header */}
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div className="page-title">Mod <span>Manager</span></div>
                        <div className="page-subtitle">
                            {view === 'manage'
                                ? `${enabledCount}/${mods.length} mods enabled for Minecraft ${selectedVersion}`
                                : `Browse and install new mods from Modrinth`
                            }
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            className={`btn ${view === 'manage' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setView('manage')}
                        >
                            My Mods
                        </button>
                        <button
                            className={`btn ${view === 'add' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => {
                                setView('add')
                                setMrOffset(0) // Reset to first page
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Add Mods
                        </button>
                    </div>
                </div>
            </div>

            {view === 'manage' ? (
                <>
                    {/* Manager View */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}
                                width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                id="mods-search"
                                className="input"
                                style={{ paddingLeft: 32, width: '100%' }}
                                placeholder="Search installed mods..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
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

                    {loading && (
                        <div className="flex-center" style={{ height: 200, flexDirection: 'column', gap: 12 }}>
                            <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                            <div className="text-secondary text-sm">Loading mods...</div>
                        </div>
                    )}

                    {!loading && mods.length === 0 && !error && (
                        <div className="flex-center" style={{ height: 200, flexDirection: 'column', gap: 10 }}>
                            <span style={{ fontSize: 36 }}>📦</span>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>No mods found</div>
                            <div className="text-sm text-secondary">Add some mods from Modrinth!</div>
                        </div>
                    )}

                    <div className="mods-grid">
                        {filtered.map(mod => {
                            const enabled = !disabledMods.has(mod.id)
                            return (
                                <div
                                    key={mod.id}
                                    className={`mod-card${!enabled ? ' disabled' : ''}`}
                                    onClick={() => handleShowOnModrinth(mod.name)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="mod-icon">{getIcon(mod.name)}</div>
                                    <div className="mod-info">
                                        <div className="mod-name">{mod.name}</div>
                                        <div className="mod-category" style={{ textTransform: 'capitalize' }}>{mod.category}</div>
                                    </div>
                                    <div
                                        className={`toggle${enabled ? ' on' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            !mod.required && toggleMod(mod.id);
                                        }}
                                        style={{ cursor: mod.required ? 'not-allowed' : 'pointer', opacity: mod.required ? 0.7 : 1 }}
                                    >
                                        <div className="toggle-thumb" />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </>
            ) : (
                <>
                    {/* Modrinth View */}
                    <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <input
                                className="input"
                                style={{ flex: 1 }}
                                placeholder="Search Modrinth (Sodium, Iris, JourneyMap...)"
                                value={mrSearch}
                                onChange={e => setMrSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleMrSearch(0)}
                            />
                            <button
                                className="btn btn-primary"
                                onClick={() => handleMrSearch(0)}
                                disabled={mrLoading}
                            >
                                {mrLoading ? 'Searching...' : 'Search'}
                            </button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {['downloads', 'relevance', 'newest', 'updated'].map(s => (
                                    <button
                                        key={s}
                                        className={`btn ${mrSort === s ? 'btn-primary' : 'btn-secondary'}`}
                                        style={{ fontSize: 10, padding: '4px 10px', textTransform: 'capitalize' }}
                                        onClick={() => { setMrSort(s); setMrOffset(0); }}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>

                            {mrTotal > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                                    <span>Page {currentPage} of {totalPages}</span>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button
                                            className="btn btn-secondary"
                                            style={{ padding: '2px 8px' }}
                                            disabled={mrOffset === 0 || mrLoading}
                                            onClick={() => handleMrSearch(mrOffset - MODS_PER_PAGE)}
                                        >
                                            &lt;
                                        </button>
                                        <button
                                            className="btn btn-secondary"
                                            style={{ padding: '2px 8px' }}
                                            disabled={mrOffset + MODS_PER_PAGE >= mrTotal || mrLoading}
                                            onClick={() => handleMrSearch(mrOffset + MODS_PER_PAGE)}
                                        >
                                            &gt;
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {mrLoading ? (
                        <div className="flex-center" style={{ height: 300 }}>
                            <div className="spinner" style={{ width: 40, height: 40 }} />
                        </div>
                    ) : (
                        <div className="mods-grid">
                            {mrResults.map(mod => (
                                <div key={mod.project_id} className="mod-card" style={{ height: 'auto', padding: 16 }}>
                                    {mod.icon_url ? (
                                        <img src={mod.icon_url} style={{ width: 42, height: 42, borderRadius: 8, objectFit: 'cover' }} alt="" />
                                    ) : (
                                        <div className="mod-icon">📦</div>
                                    )}
                                    <div className="mod-info" style={{ flex: 1, marginLeft: 16 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div className="mod-name" style={{ fontSize: 14 }}>{mod.title}</div>
                                            {mod.downloads && (
                                                <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                                                    </svg>
                                                    {(mod.downloads / 1000000).toFixed(1)}M
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 32 }}>
                                            {mod.description}
                                        </div>
                                        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                                            {mod.categories.slice(0, 3).map(c => (
                                                <span key={c} style={{ fontSize: 9, background: 'var(--bg-tertiary)', color: 'var(--text-accent)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', fontWeight: 600 }}>
                                                    {c}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <button
                                        className={`btn ${installingId === mod.project_id ? 'btn-secondary' : 'btn-primary'}`}
                                        style={{ padding: '8px 16px', fontSize: 12, marginLeft: 12 }}
                                        disabled={installingId === mod.project_id}
                                        onClick={() => installMod(mod)}
                                    >
                                        {installingId === mod.project_id ? 'Installing...' : 'Install'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
