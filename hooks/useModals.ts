import { useState, useCallback, useMemo } from 'react';

export type ModalName = 
  | 'employeeList'
  | 'lowBalance'
  | 'decreeBook'
  | 'shortcuts'
  | 'calendar'
  | 'themeSelector'
  | 'confirmDelete';

interface ModalState {
  employeeList: boolean;
  lowBalance: boolean;
  decreeBook: boolean;
  shortcuts: boolean;
  calendar: boolean;
  themeSelector: boolean;
  confirmDelete: boolean;
}

interface UseModalsReturn {
  modals: ModalState;
  openModal: (name: ModalName) => void;
  closeModal: (name: ModalName) => void;
  toggleModal: (name: ModalName) => void;
  closeAllModals: () => void;
  isAnyModalOpen: boolean;
}

const initialState: ModalState = {
  employeeList: false,
  lowBalance: false,
  decreeBook: false,
  shortcuts: false,
  calendar: false,
  themeSelector: false,
  confirmDelete: false,
};

export const useModals = (): UseModalsReturn => {
  const [modals, setModals] = useState<ModalState>(initialState);

  const openModal = useCallback((name: ModalName) => {
    setModals(prev => ({ ...prev, [name]: true }));
  }, []);

  const closeModal = useCallback((name: ModalName) => {
    setModals(prev => ({ ...prev, [name]: false }));
  }, []);

  const toggleModal = useCallback((name: ModalName) => {
    setModals(prev => ({ ...prev, [name]: !prev[name] }));
  }, []);

  const closeAllModals = useCallback(() => {
    setModals(initialState);
  }, []);

  const isAnyModalOpen = useMemo(() => 
    Object.values(modals).some(Boolean),
    [modals]
  );

  return {
    modals,
    openModal,
    closeModal,
    toggleModal,
    closeAllModals,
    isAnyModalOpen,
  };
};

export default useModals;
