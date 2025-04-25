import { useState, useEffect, useCallback } from 'react';

const PROJECT_ID_STORAGE_KEY = 'selectedProjectId';

export function useProjectSelection(): [
    string | null, // selectedProjectId
    (projectId: string | null) => void // setSelectedProjectId
] {
    const [selectedProjectId, setSelectedProjectIdState] = useState<string | null>(null);

    // Load initial value from localStorage on mount (client-side only)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedProjectId = localStorage.getItem(PROJECT_ID_STORAGE_KEY);
            setSelectedProjectIdState(storedProjectId);
            console.log("Loaded project ID from localStorage:", storedProjectId);
        }
    }, []);

    // Function to update state and localStorage
    const setSelectedProjectId = useCallback((projectId: string | null) => {
        setSelectedProjectIdState(projectId);
        if (typeof window !== 'undefined') {
            if (projectId) {
                localStorage.setItem(PROJECT_ID_STORAGE_KEY, projectId);
                console.log("Saved project ID to localStorage:", projectId);
            } else {
                localStorage.removeItem(PROJECT_ID_STORAGE_KEY);
                console.log("Removed project ID from localStorage");
            }
        }
    }, []);

    return [selectedProjectId, setSelectedProjectId];
} 