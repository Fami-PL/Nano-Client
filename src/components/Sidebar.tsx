import { useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { invoke } from '@tauri-apps/api/core'

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
    {
        path: '/logs',
        label: 'Logs',
        icon: (
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
    },
]

import logo from '../assets/logo.png'

export default function Sidebar() {
    const navigate = useNavigate()
    const location = useLocation()
    const { activeInstances, showToast, selectedVersion } = useStore()

    const handleKill = async (version: string, username: string) => {
        try {
            await invoke('kill_instance', { version, username })
            showToast('Instance terminated')
        } catch (e) {
            console.error('Failed to kill instance:', e)
            showToast('Failed to kill instance')
        }
    }

    return (
        <aside className="sidebar">
            {/* Logo */}
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">
                    <img src={logo} alt="Nano Client" />
                </div>
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
                {activeInstances.length > 0 ? (
                    <div className="active-instances-list">
                        <div className="nav-section-label" style={{ padding: '0 4px 6px' }}>Running Minecraft</div>
                        {activeInstances.map((inst, idx) => (
                            <div key={idx} className="instance-item">
                                <div className="instance-info" title={`${inst.username} @ ${inst.version}`}>
                                    <div className="instance-dot" />
                                    <div className="instance-details">
                                        <div className="instance-version">{inst.version}</div>
                                        <div className="instance-user">{inst.username}</div>
                                    </div>
                                </div>
                                <button
                                    className="instance-kill"
                                    onClick={() => handleKill(inst.version, inst.username)}
                                    title="Kill instance"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="version-badge">
                        <div className="version-badge-dot" style={{ background: 'var(--text-muted)' }} />
                        <div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                {selectedVersion}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                Ready to launch
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    )
}
