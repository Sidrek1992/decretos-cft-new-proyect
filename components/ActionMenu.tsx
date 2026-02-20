import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, FileDown, FilePen, Edit2, Trash, Eye } from 'lucide-react';
import { PermitRecord } from '../types';

interface ActionMenuProps {
    record: PermitRecord;
    onEdit?: (record: PermitRecord) => void;
    onDelete?: (id: string) => void;
    onGeneratePDF: (record: PermitRecord, forcePdf: boolean) => void;
    onPreview?: (record: PermitRecord) => void;
}

interface MenuAction {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
    color: string;
    bg: string;
    divider?: boolean;
}

interface MenuPosition {
    top: number;
    left: number;
    maxHeight: number;
    openUpwards: boolean;
}

const MENU_WIDTH = 192;
const MENU_GAP = 8;
const VIEWPORT_MARGIN = 8;
const MIN_MENU_HEIGHT = 140;

const ActionMenu: React.FC<ActionMenuProps> = ({ record, onEdit, onDelete, onGeneratePDF, onPreview }) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [menuPosition, setMenuPosition] = useState<MenuPosition>({
        top: 0,
        left: 0,
        maxHeight: 320,
        openUpwards: false,
    });

    const actions = useMemo<MenuAction[]>(() => [
        ...(onPreview ? [{
            icon: Eye,
            label: 'Previsualizar',
            onClick: () => onPreview(record),
            color: 'text-purple-600 dark:text-purple-400',
            bg: 'hover:bg-purple-50 dark:hover:bg-purple-900/30'
        }] : []),
        {
            icon: FileDown,
            label: 'Ver PDF',
            onClick: () => onGeneratePDF(record, true),
            color: 'text-rose-600 dark:text-rose-400',
            bg: 'hover:bg-rose-50 dark:hover:bg-rose-900/30'
        },
        {
            icon: FilePen,
            label: 'Abrir en Drive',
            onClick: () => onGeneratePDF(record, false),
            color: 'text-sky-600 dark:text-sky-400',
            bg: 'hover:bg-sky-50 dark:hover:bg-sky-900/30'
        },
        ...(onEdit ? [{
            icon: Edit2,
            label: 'Modificar',
            onClick: () => onEdit(record),
            color: 'text-amber-600 dark:text-amber-400',
            bg: 'hover:bg-amber-50 dark:hover:bg-amber-900/30'
        }] : []),
        ...(onDelete ? [{
            icon: Trash,
            label: 'Eliminar',
            onClick: () => onDelete(record.id),
            color: 'text-red-600 dark:text-red-400',
            bg: 'hover:bg-red-50 dark:hover:bg-red-900/30',
            divider: true
        }] : [])
    ], [onPreview, onGeneratePDF, onEdit, onDelete, record]);

    const updateMenuPosition = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;

        const triggerRect = trigger.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const measuredWidth = menuRef.current?.offsetWidth ?? MENU_WIDTH;
        const estimatedHeight = Math.max(MIN_MENU_HEIGHT, actions.length * 46 + 12);
        const measuredHeight = menuRef.current?.offsetHeight ?? estimatedHeight;

        const spaceBelow = viewportHeight - triggerRect.bottom - MENU_GAP - VIEWPORT_MARGIN;
        const spaceAbove = triggerRect.top - MENU_GAP - VIEWPORT_MARGIN;
        const openUpwards = measuredHeight > spaceBelow && spaceAbove > spaceBelow;

        const maxHeight = openUpwards
            ? Math.max(MIN_MENU_HEIGHT, spaceAbove)
            : Math.max(MIN_MENU_HEIGHT, spaceBelow);

        let top = openUpwards
            ? triggerRect.top - MENU_GAP - Math.min(measuredHeight, maxHeight)
            : triggerRect.bottom + MENU_GAP;

        let left = triggerRect.right - measuredWidth;

        top = Math.min(
            Math.max(VIEWPORT_MARGIN, top),
            viewportHeight - VIEWPORT_MARGIN - Math.min(measuredHeight, maxHeight)
        );

        left = Math.min(
            Math.max(VIEWPORT_MARGIN, left),
            viewportWidth - VIEWPORT_MARGIN - measuredWidth
        );

        setMenuPosition({ top, left, maxHeight, openUpwards });
    }, [actions.length]);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const clickedOnTrigger = !!triggerRef.current?.contains(target);
            const clickedOnMenu = !!menuRef.current?.contains(target);
            if (!clickedOnTrigger && !clickedOnMenu) {
                setIsOpen(false);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        updateMenuPosition();
        const rafId = requestAnimationFrame(updateMenuPosition);

        const handleViewportChange = () => updateMenuPosition();

        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('scroll', handleViewportChange, true);

        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('resize', handleViewportChange);
            window.removeEventListener('scroll', handleViewportChange, true);
        };
    }, [isOpen, updateMenuPosition]);

    const menu = isOpen
        ? createPortal(
            <div
                ref={menuRef}
                style={{
                    position: 'fixed',
                    top: menuPosition.top,
                    left: menuPosition.left,
                    width: MENU_WIDTH,
                    maxHeight: menuPosition.maxHeight,
                    zIndex: 260,
                }}
                className={`glass-card border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-200 ${menuPosition.openUpwards ? 'origin-bottom-right' : 'origin-top-right'}`}
            >
                {actions.map((action, index) => (
                    <React.Fragment key={`${action.label}-${index}`}>
                        {action.divider && (
                            <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                        )}
                        <button
                            onClick={() => {
                                action.onClick();
                                setIsOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${action.bg}`}
                        >
                            <action.icon className={`w-4 h-4 ${action.color}`} />
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                {action.label}
                            </span>
                        </button>
                    </React.Fragment>
                ))}
            </div>,
            document.body
        )
        : null;

    return (
        <div className="relative">
            <button
                ref={triggerRef}
                onClick={() => setIsOpen(!isOpen)}
                className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-90"
                aria-expanded={isOpen}
                aria-haspopup="menu"
            >
                <MoreVertical size={16} />
            </button>
            {menu}
        </div>
    );
};

export default ActionMenu;
