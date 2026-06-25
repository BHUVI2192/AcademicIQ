import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useColleges } from '@/hooks/useColleges';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import type { College } from '@shared';

interface DirectoryContextType {
  selectedCollegeId: string | null;
  setSelectedCollegeId: (id: string | null) => void;
  selectedAcademicYearId: string | null;
  setSelectedAcademicYearId: (id: string | null) => void;
  selectedCollege: College | null;
  isGlobalMode: boolean;
}

const DirectoryContext = createContext<DirectoryContextType | undefined>(undefined);

export function DirectoryProvider({ children }: { children: React.ReactNode }) {
  const { collegeId, role } = useAuth();
  const { data: colleges } = useColleges();
  const [selectedCollegeId, setSelectedCollegeIdState] = useState<string | null>(() => {
    return localStorage.getItem('academeiq-selected-college');
  });
  const { data: years } = useAcademicYears(selectedCollegeId);
  const [selectedAcademicYearId, setSelectedAcademicYearIdState] = useState<string | null>(() => {
    return localStorage.getItem('academeiq-selected-year');
  });

  const isGlobalMode = role === 'admin' && !collegeId;

  const selectedCollege = colleges?.find(c => c.id === selectedCollegeId) || null;

  const setSelectedCollegeId = (id: string | null) => {
    setSelectedCollegeIdState(id);
    if (id) {
      localStorage.setItem('academeiq-selected-college', id);
    } else {
      localStorage.removeItem('academeiq-selected-college');
    }
  };

  const setSelectedAcademicYearId = (id: string | null) => {
    setSelectedAcademicYearIdState(id);
    if (id) {
      localStorage.setItem('academeiq-selected-year', id);
    } else {
      localStorage.removeItem('academeiq-selected-year');
    }
  };

  // If not in global mode, force selected to be the profile collegeId
  useEffect(() => {
    if (!isGlobalMode && collegeId) {
      setSelectedCollegeIdState(collegeId);
    }
  }, [isGlobalMode, collegeId]);

  // Auto-select SJPC if in global mode and no selection yet
  useEffect(() => {
    if (isGlobalMode && !selectedCollegeId && colleges && colleges.length > 0) {
      // Find SJPC (Saint Joseph PU College) or default to first college
      const sjpc = colleges.find(c => c.name === 'Saint Joseph PU College');
      if (sjpc) {
        setSelectedCollegeId(sjpc.id);
      } else if (colleges.length === 1) {
        setSelectedCollegeId(colleges[0].id);
      }
    }
  }, [isGlobalMode, selectedCollegeId, colleges]);

  // Auto-select current year if none selected or if selectedYear does not exist in the current college's years
  useEffect(() => {
    if (years && years.length > 0) {
      const yearExists = years.some(y => y.id === selectedAcademicYearId);
      if (!selectedAcademicYearId || !yearExists) {
        const current = years.find(y => y.is_current);
        if (current) {
          setSelectedAcademicYearId(current.id);
        } else {
          setSelectedAcademicYearId(years[0].id);
        }
      }
    }
  }, [years, selectedAcademicYearId]);

  return (
    <DirectoryContext.Provider value={{ 
      selectedCollegeId, 
      setSelectedCollegeId, 
      selectedAcademicYearId,
      setSelectedAcademicYearId,
      selectedCollege, 
      isGlobalMode 
    }}>
      {children}
    </DirectoryContext.Provider>
  );
}


export function useDirectory() {
  const context = useContext(DirectoryContext);
  if (context === undefined) {
    throw new Error('useDirectory must be used within a DirectoryProvider');
  }
  return context;
}
