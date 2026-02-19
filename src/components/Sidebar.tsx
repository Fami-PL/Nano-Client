import { useNavigate, useLocation } from 'react-router-dom'
import { useStore, MC_VERSIONS } from '../store/useStore'

const NAV_ITEMS = [
    {
        path: '/',
        label: 'Home',
        icon: (
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        ),
    },
    {
        path: '/mods',
        label: 'Mods',
        icon: (
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
        ),
    },
    {
        path: '/settings',
        label: 'Settings',
        icon: (
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
    },
]

export default function Sidebar() {
    const navigate = useNavigate()
    const location = useLocation()
    const { selectedVersion, launchStatus } = useStore()

    const versionInfo = MC_VERSIONS.find(v => v.version === selectedVersion)

    return (
        <aside className="sidebar">
            {/* Logo */}
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">⚡</div>
                <div>
                    <div className="sidebar-logo-text">Nano Client</div>
                    <div className="sidebar-logo-sub">FPS Client</div>
                </div>
            </div>

            {/* Nav */}
            <nav className="sidebar-nav">
                <div className="nav-section-label">Navigation</div>
                {NAV_ITEMS.map((item) => (
                    <div
                        key={item.path}
                        className={`nav-item${location.pathname === item.path ? ' active' : ''}`}
                        onClick={() => navigate(item.path)}
                        id={`nav-${item.label.toLowerCase()}`}
                    >
                        <span className="nav-item-icon">{item.icon}</span>
                        {item.label}
                    </div>
                ))}
            </nav>

            {/* Footer */}
            <div className="sidebar-footer">
                <div className="version-badge">
                    <div className={`version-badge-dot${launchStatus === 'running' ? '' : ''}`}
                        style={{ background: launchStatus === 'running' ? 'var(--success)' : launchStatus === 'error' ? 'var(--error)' : 'var(--text-muted)' }}
                    />
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {selectedVersion}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                            Fabric {versionInfo?.fabricLoader}
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    )
}
