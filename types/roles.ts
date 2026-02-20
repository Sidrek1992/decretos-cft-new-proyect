// Tipos de roles disponibles
export type UserRole = 'admin' | 'editor' | 'reader';

// Permisos por acción
export interface Permissions {
    // Decretos
    canCreateDecree: boolean;
    canEditDecree: boolean;
    canDeleteDecree: boolean;
    canGeneratePDF: boolean;

    // Funcionarios
    canManageEmployees: boolean;

    // Exportación
    canExportExcel: boolean;
    canExportDashboard: boolean;

    // Configuración
    canAccessSettings: boolean;
}

// Definición de permisos por rol
export const ROLE_PERMISSIONS: Record<UserRole, Permissions> = {
    admin: {
        canCreateDecree: true,
        canEditDecree: true,
        canDeleteDecree: true,
        canGeneratePDF: true,
        canManageEmployees: true,
        canExportExcel: true,
        canExportDashboard: true,
        canAccessSettings: true,
    },
    editor: {
        canCreateDecree: true,
        canEditDecree: true,
        canDeleteDecree: false,
        canGeneratePDF: true,
        canManageEmployees: true,
        canExportExcel: true,
        canExportDashboard: true,
        canAccessSettings: false,
    },
    reader: {
        canCreateDecree: false,
        canEditDecree: false,
        canDeleteDecree: false,
        canGeneratePDF: true, // ★ Puede generar PDFs
        canManageEmployees: false,
        canExportExcel: true, // ★ Puede exportar Excel para consulta
        canExportDashboard: true,
        canAccessSettings: false,
    },
};

// Labels para mostrar en UI
export const ROLE_LABELS: Record<UserRole, string> = {
    admin: 'Administrador',
    editor: 'Editor',
    reader: 'Lector',
};

// Colores para badges
export const ROLE_COLORS: Record<UserRole, { bg: string; text: string }> = {
    admin: {
        bg: 'bg-purple-100 dark:bg-purple-900/40',
        text: 'text-purple-700 dark:text-purple-300',
    },
    editor: {
        bg: 'bg-amber-100 dark:bg-amber-900/40',
        text: 'text-amber-700 dark:text-amber-300',
    },
    reader: {
        bg: 'bg-sky-100 dark:bg-sky-900/40',
        text: 'text-sky-700 dark:text-sky-300',
    },
};

// Helper para obtener permisos de un rol
export const getPermissions = (role: UserRole): Permissions => {
    return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.reader;
};

// Helper para verificar un permiso específico
export const hasPermission = (role: UserRole, permission: keyof Permissions): boolean => {
    const permissions = getPermissions(role);
    return permissions[permission];
};
