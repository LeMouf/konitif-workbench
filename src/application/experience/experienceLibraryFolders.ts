export type LibraryFolders = {
    version: 1;
    folders: {
        id: string;
        name: string;
        parentId?: string;
        experienceId?: string;
    }[];
    experienceAssignments?: Record<string, boolean>;
    assignments: Record<string, string>;
};
export const libraryFoldersKey = 'konitif.library.folders.v1';
export function emptyLibraryFolders(): LibraryFolders { return { version: 1, folders: [], assignments: {} }; }
export function readLibraryFolders(text: string | null): LibraryFolders {
    if (!text)
        return emptyLibraryFolders();
    const value = JSON.parse(text);
    if (value?.version !== 1 || !Array.isArray(value.folders) || value.folders.length > 100 || !value.assignments || typeof value.assignments !== 'object' || Array.isArray(value.assignments))
        throw Error('Organisation des dossiers illisible ; son stockage est conservé.');
    const ids = new Set<string>();
    for (const f of value.folders) {
        if (typeof f?.id !== 'string' || !f.id || ids.has(f.id) || typeof f.name !== 'string' || !f.name.trim() || f.name.length > 80)
            throw Error('Dossier invalide ; son stockage est conservé.');
        ids.add(f.id);
    }
    for (const folder of value.folders) {
        const seen = new Set<string>([folder.id]);
        let parent = folder.parentId;
        while (parent) {
            if (typeof parent !== 'string' || !ids.has(parent) || seen.has(parent))
                throw Error('Hiérarchie de dossiers invalide.');
            seen.add(parent);
            parent = value.folders.find((f: {
                id: string;
            }) => f.id === parent)?.parentId;
        }
    }
    for (const id of Object.values(value.assignments))
        if (typeof id !== 'string' || !ids.has(id))
            throw Error('Classement invalide ; son stockage est conservé.');
    return value;
}
export function addLibraryFolder(state: LibraryFolders, id: string, name: string, parentId?: string): LibraryFolders {
    name = name.trim();
    if (!name || name.length > 80 || state.folders.length >= 100 || state.folders.some(f => f.id === id || f.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
        throw Error('Choisir un nom de dossier unique (80 caractères maximum).');
    if (parentId && !state.folders.some(f => f.id === parentId))
        throw Error('Dossier parent introuvable.');
    return { ...state, folders: [...state.folders, { id, name, ...(parentId ? { parentId } : {}) }] };
}
export function moveLibraryResource(state: LibraryFolders, resourceId: string, folderId: string): LibraryFolders {
    if (folderId && !state.folders.some(f => f.id === folderId))
        throw Error('Dossier introuvable.');
    const assignments = { ...state.assignments };
    if (folderId)
        assignments[resourceId] = folderId;
    else
        delete assignments[resourceId];
    return { ...state, assignments };
}
export function removeLibraryFolder(state: LibraryFolders, id: string): LibraryFolders {
    return { ...state, folders: state.folders.filter(f => f.id !== id).map(f => f.parentId === id ? { ...f, parentId: state.folders.find(parent => parent.id === id)?.parentId } : f), assignments: Object.fromEntries(Object.entries(state.assignments).filter(([, folder]) => folder !== id)) };
}
export function libraryFolderTrail(state: LibraryFolders, id: string): {
    id: string;
    name: string;
}[] { const result: {
    id: string;
    name: string;
}[] = []; const seen = new Set<string>(); let current = state.folders.find(f => f.id === id); while (current && !seen.has(current.id)) {
    seen.add(current.id);
    result.unshift({ id: current.id, name: current.name });
    current = state.folders.find(f => f.id === current!.parentId);
} return result; }
export function renameLibraryFolder(state: LibraryFolders, id: string, name: string): LibraryFolders {
    name = name.trim();
    if (!state.folders.some(folder => folder.id === id))
        throw Error('Dossier introuvable.');
    if (!name || name.length > 80 || state.folders.some(folder => folder.id !== id && folder.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
        throw Error('Choisir un nom de dossier unique (80 caractères maximum).');
    return { ...state, folders: state.folders.map(folder => folder.id === id ? { ...folder, name } : folder) };
}
export function organizeExperienceLibraryResources(state: LibraryFolders, sources: {
    id: string;
    resourceKey?: string;
    experienceAssets?: {
        experienceId: string;
        experienceName: string;
        folderId: string;
        parentName: string;
    }[];
}[]): LibraryFolders {
    let next = state;
    const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    for (const source of sources) {
        for (const root of source.experienceAssets ?? []) {
            if (!root.experienceId || !root.folderId || !root.experienceName)
                continue;
            let parent = next.folders.find(folder => !folder.parentId && ['experience', 'experiences'].includes(normalized(folder.name)));
            if (!parent) {
                next = addLibraryFolder(next, 'experience-resources', 'Expériences');
                parent = next.folders.find(folder => folder.id === 'experience-resources')!;
            }
            let folder = next.folders.find(folder => folder.experienceId === root.experienceId || folder.id === root.folderId);
            if (!folder) {
                const candidate = next.folders.find(folder => folder.parentId === parent!.id && !folder.experienceId && normalized(folder.name) === normalized(root.experienceName));
                if (candidate) {
                    folder = { ...candidate, experienceId: root.experienceId };
                    next = { ...next, folders: next.folders.map(item => item.id === folder!.id ? folder! : item) };
                }
                else {
                    let name = root.experienceName.slice(0, 80);
                    if (next.folders.some(folder => normalized(folder.name) === normalized(name)))
                        name = name.slice(0, 52) + ' · ' + root.folderId.slice(-12);
                    next = addLibraryFolder(next, root.folderId, name, parent.id);
                    folder = { ...next.folders.find(item => item.id === root.folderId)!, experienceId: root.experienceId };
                    next = { ...next, folders: next.folders.map(item => item.id === folder!.id ? folder! : item) };
                }
            }
            if (!source.id)
                continue;
            const key = source.resourceKey ?? 'audio:' + source.id;
            if (!next.experienceAssignments?.[key]) {
                next = { ...next, assignments: next.assignments[key] ? next.assignments : { ...next.assignments, [key]: folder.id }, experienceAssignments: { ...next.experienceAssignments, [key]: true } };
            }
        }
    }
    return next;
}
