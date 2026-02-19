import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type MCVersion = '1.20.1' | '1.20.4' | '1.21.1' | '1.21.4' | '1.21.6' | '1.21.8' | '1.21.10'

export interface VersionInfo {
    version: MCVersion
    fabricLoader: string
    javaVersion: number
}

export const MC_VERSIONS: VersionInfo[] = [
    { version: '1.20.1', fabricLoader: '0.16.14', javaVersion: 17 },
    { version: '1.20.4', fabricLoader: '0.16.14', javaVersion: 17 },
    { version: '1.21.1', fabricLoader: '0.16.14', javaVersion: 21 },
    { version: '1.21.4', fabricLoader: '0.16.14', javaVersion: 21 },
    { version: '1.21.6', fabricLoader: '0.16.14', javaVersion: 21 },
    { version: '1.21.8', fabricLoader: '0.16.14', javaVersion: 21 },
    { version: '1.21.10', fabricLoader: '0.16.14', javaVersion: 21 },
]

export interface ModInfo {
    id: string
    name: string
    filename: string
    url: string
    sha256?: string
    required: boolean
    category: 'performance' | 'visual' | 'utility' | 'library'
    description?: string
    icon?: string
}

export type LaunchStatus = 'idle' | 'fetching' | 'downloading' | 'installing_fabric' | 'launching' | 'running' | 'error'

export interface DownloadProgress {
    current: number
    total: number
    file: string
    percentage: number
}

interface NanoStore {
    // Version
    selectedVersion: MCVersion
    setSelectedVersion: (v: MCVersion) => void

    // Settings
    username: string
    setUsername: (u: string) => void
    ram: number
    setRam: (r: number) => void
    javaPath: string
    setJavaPath: (p: string) => void
    jvmArgs: string
    setJvmArgs: (a: string) => void
    modlistUrl: string
    setModlistUrl: (u: string) => void
    clientDir: string
    setClientDir: (d: string) => void

    // Mods
    mods: ModInfo[]
    setMods: (m: ModInfo[]) => void
    disabledMods: Set<string>
    toggleMod: (id: string) => void
    modsLoaded: boolean
    setModsLoaded: (b: boolean) => void

    // Launch
    launchStatus: LaunchStatus
    setLaunchStatus: (s: LaunchStatus) => void
    downloadProgress: DownloadProgress | null
    setDownloadProgress: (p: DownloadProgress | null) => void
    launchError: string | null
    setLaunchError: (e: string | null) => void

    // Toast
    toast: string | null
    showToast: (msg: string) => void
}

export const useStore = create<NanoStore>()(
    persist(
        (set, get) => ({
            selectedVersion: '1.21.4',
            setSelectedVersion: (v) => set({ selectedVersion: v }),

            username: 'Player',
            setUsername: (u) => set({ username: u }),
            ram: 4,
            setRam: (r) => set({ ram: r }),
            javaPath: '',
            setJavaPath: (p) => set({ javaPath: p }),
            jvmArgs: '',
            setJvmArgs: (a) => set({ jvmArgs: a }),
            modlistUrl: 'https://raw.githubusercontent.com/Fami-PL/nano-client-api/main/modlist.json',
            setModlistUrl: (u) => set({ modlistUrl: u }),
            clientDir: '',
            setClientDir: (d) => set({ clientDir: d }),

            mods: [],
            setMods: (m) => set({ mods: m }),
            disabledMods: new Set<string>(),
            toggleMod: (id) => {
                const d = new Set(get().disabledMods)
                if (d.has(id)) d.delete(id); else d.add(id)
                set({ disabledMods: d })
            },
            modsLoaded: false,
            setModsLoaded: (b) => set({ modsLoaded: b }),

            launchStatus: 'idle',
            setLaunchStatus: (s) => set({ launchStatus: s }),
            downloadProgress: null,
            setDownloadProgress: (p) => set({ downloadProgress: p }),
            launchError: null,
            setLaunchError: (e) => set({ launchError: e }),

            toast: null,
            showToast: (msg) => {
                set({ toast: msg })
                setTimeout(() => set({ toast: null }), 3000)
            },
        }),
        {
            name: 'nano-client-storage',
            partialize: (s) => ({
                selectedVersion: s.selectedVersion,
                username: s.username,
                ram: s.ram,
                javaPath: s.javaPath,
                jvmArgs: s.jvmArgs,
                modlistUrl: s.modlistUrl,
                clientDir: s.clientDir,
                disabledMods: Array.from(s.disabledMods),
            }),
            merge: (persisted: any, current) => ({
                ...current,
                ...persisted,
                disabledMods: new Set(persisted?.disabledMods || []),
            }),
        }
    )
)
