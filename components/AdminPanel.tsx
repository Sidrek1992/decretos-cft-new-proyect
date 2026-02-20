
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    X,
    Settings,
    Users,
    UserPlus,
    Trash2,
    Crown,
    Eye,
    EyeOff,
    Loader2,
    AlertCircle,
    CheckCircle,
    Mail,
    Save,
    KeyRound,
    ShieldAlert,
    Clock3,
    History,
    FileText,
    ArrowRight,
    Search as SearchIcon,
    Filter,
    ShieldCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PermitRecord, Employee } from '../types';
import DataAuditorView from './DataAuditorView';
import { UserRole, ROLE_LABELS, ROLE_COLORS } from '../types/roles';
import {
    loadUserRoles,
    saveUserRoles,
    loadUserProfiles,
    saveUserProfiles,
    loadUserPasswords,
    saveUserPasswords,
    loadUserSecurity,
    saveUserSecurity,
    updateUserSecurity,
    isMandatoryAdminEmail
} from '../utils/userAdminStorage';
import { appendAuditLog, getAuditLog, fetchRemoteAuditLogs, AuditEntry } from '../utils/audit';
import { subscribeToProfileChanges } from '../services/realtimeSync';

interface AdminPanelProps {
    isOpen: boolean;
    onClose: () => void;
    records: PermitRecord[];
    employees?: Employee[];
    onSelectRecord?: (record: PermitRecord) => void;
}

interface ManagedUser {
    email: string;
    role: UserRole;
    firstName: string;
    lastName: string;
    password: string;
    blocked: boolean;
    forcePasswordChange: boolean;
    lastAccessAt: number | null;
    createdAt?: string;
}

interface RemoteProfileInput {
    email: string;
    role: UserRole;
    firstName: string;
    lastName: string;
}


export const getUserRole = (email: string): UserRole => {
    const roles = loadUserRoles();
    return roles[email.toLowerCase()] || 'reader';
};

export const isAdminEmail = (email: string): boolean => {
    return getUserRole(email) === 'admin';
};

const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose, records, employees = [], onSelectRecord }) => {
    const [users, setUsers] = useState<ManagedUser[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [createFirstName, setCreateFirstName] = useState('');
    const [createLastName, setCreateLastName] = useState('');
    const [createEmail, setCreateEmail] = useState('');
    const [createPassword, setCreatePassword] = useState('');
    const [createRole, setCreateRole] = useState<UserRole>('reader');
    const [showCreatePassword, setShowCreatePassword] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const [isResettingByEmail, setIsResettingByEmail] = useState<Record<string, boolean>>({});
    const [profileDrafts, setProfileDrafts] = useState<Record<string, { firstName: string; lastName: string }>>({});
    const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
    const [showPasswordByEmail, setShowPasswordByEmail] = useState<Record<string, boolean>>({});
    const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'data_audit'>('users');
    const [remoteAuditLogs, setRemoteAuditLogs] = useState<AuditEntry[]>([]);
    const [isLoadingAudit, setIsLoadingAudit] = useState(false);
    const [auditSearch, setAuditSearch] = useState('');
    const [selectedAuditEntry, setSelectedAuditEntry] = useState<AuditEntry | null>(null);
    const [adminAuditEntries, setAdminAuditEntries] = useState(() => getAuditLog().slice(0, 30));
    const profilesRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const upsertRemoteProfile = async ({ email, role, firstName, lastName }: RemoteProfileInput): Promise<void> => {
        const { error: upsertError } = await supabase
            .from('profiles')
            .upsert({
                email: email.toLowerCase(),
                role,
                first_name: firstName,
                last_name: lastName
            }, { onConflict: 'email' });

        if (upsertError) {
            throw upsertError;
        }
    };

    const loadUsers = useCallback(async () => {
        const roles = loadUserRoles();
        const profiles = loadUserProfiles();
        const passwords = loadUserPasswords();
        const security = loadUserSecurity();
        const remoteProfilesByEmail: Record<string, { role: UserRole; firstName: string; lastName: string }> = {};

        try {
            const { data } = await supabase
                .from('profiles')
                .select('email, role, first_name, last_name');

            (data || []).forEach((row: any) => {
                const email = String(row?.email || '').trim().toLowerCase();
                if (!email) return;

                const rawRole = String(row?.role || '').toLowerCase();
                const role: UserRole = rawRole === 'admin' || rawRole === 'editor' || rawRole === 'reader'
                    ? rawRole
                    : 'reader';

                remoteProfilesByEmail[email] = {
                    role,
                    firstName: String(row?.first_name || '').trim(),
                    lastName: String(row?.last_name || '').trim()
                };
            });
        } catch {
            // fallback local si la tabla no existe o hay error de permisos
        }

        const emails = new Set<string>([
            ...Object.keys(roles),
            ...Object.keys(profiles),
            ...Object.keys(passwords),
            ...Object.keys(security),
            ...Object.keys(remoteProfilesByEmail)
        ]);

        const userList: ManagedUser[] = Array.from(emails)
            .map((rawEmail) => {
                const email = rawEmail.toLowerCase();
                const localProfile = profiles[email] || { firstName: '', lastName: '' };
                const remoteProfile = remoteProfilesByEmail[email];
                const sec = security[email] || { blocked: false, forcePasswordChange: false, lastAccessAt: null };
                return {
                    email,
                    role: remoteProfile ? remoteProfile.role : (roles[email] || 'reader'),
                    firstName: remoteProfile ? remoteProfile.firstName : localProfile.firstName,
                    lastName: remoteProfile ? remoteProfile.lastName : localProfile.lastName,
                    password: passwords[email] || '',
                    blocked: Boolean(sec.blocked),
                    forcePasswordChange: Boolean(sec.forcePasswordChange),
                    lastAccessAt: sec.lastAccessAt ?? null
                };
            })
            .sort((a, b) => a.email.localeCompare(b.email));

        setUsers(userList);
        setAdminAuditEntries(getAuditLog().slice(0, 30));
    }, []);

    const loadRemoteAudit = useCallback(async () => {
        setIsLoadingAudit(true);
        try {
            const logs = await fetchRemoteAuditLogs(100);
            setRemoteAuditLogs(logs);
        } finally {
            setIsLoadingAudit(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen && activeTab === 'audit') {
            void loadRemoteAudit();
        }
    }, [isOpen, activeTab, loadRemoteAudit]);

    useEffect(() => {
        if (isOpen) {
            void loadUsers();
        }
    }, [isOpen, loadUsers]);

    useEffect(() => {
        if (!isOpen) return;

        const unsubscribe = subscribeToProfileChanges({
            channelKey: 'admin-panel',
            onChange: () => {
                if (profilesRefreshTimeoutRef.current) return;

                profilesRefreshTimeoutRef.current = setTimeout(() => {
                    profilesRefreshTimeoutRef.current = null;
                    void loadUsers();
                }, 600);
            }
        });

        return () => {
            if (profilesRefreshTimeoutRef.current) {
                clearTimeout(profilesRefreshTimeoutRef.current);
                profilesRefreshTimeoutRef.current = null;
            }
            unsubscribe();
        };
    }, [isOpen, loadUsers]);

    const handleCreateUser = async () => {
        if (!createFirstName.trim() || !createLastName.trim() || !createEmail.trim() || !createPassword.trim()) {
            setError('Nombre, apellido, email y contraseña son requeridos');
            return;
        }

        if (createPassword.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setIsCreating(true);
        setError(null);
        setSuccess(null);

        try {
            const email = createEmail.trim().toLowerCase();
            const firstName = createFirstName.trim();
            const lastName = createLastName.trim();

            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password: createPassword,
                options: {
                    emailRedirectTo: window.location.origin,
                    data: {
                        role: createRole,
                        first_name: firstName,
                        last_name: lastName,
                        full_name: `${firstName} ${lastName}`.trim()
                    }
                }
            });

            if (signUpError) {
                throw signUpError;
            }

            const roles = loadUserRoles();
            roles[email] = createRole;
            saveUserRoles(roles);

            const profiles = loadUserProfiles();
            profiles[email] = { firstName, lastName };
            saveUserProfiles(profiles);

            const passwords = loadUserPasswords();
            passwords[email] = createPassword;
            saveUserPasswords(passwords);

            const security = loadUserSecurity();
            security[email] = { blocked: false, forcePasswordChange: false, lastAccessAt: null };
            saveUserSecurity(security);

            try {
                await upsertRemoteProfile({ email, role: createRole, firstName, lastName });
            } catch {
                // mantenemos fallback local
            }

            appendAuditLog({
                scope: 'admin',
                action: 'create_user',
                actor: 'admin',
                target: email,
                details: `Creado con rol ${createRole}`
            });

            void loadUsers();

            setSuccess(`Usuario ${email} creado exitosamente como ${ROLE_LABELS[createRole]}`);
            setCreateFirstName('');
            setCreateLastName('');
            setCreateEmail('');
            setCreatePassword('');
            setCreateRole('reader');
            setShowCreatePassword(false);
        } catch (err: any) {
            if (err.message?.includes('already registered')) {
                setError('Este email ya está registrado');
            } else {
                setError(err.message || 'Error al crear usuario');
            }
        } finally {
            setIsCreating(false);
        }
    };

    const handleChangeRole = async (email: string, newRole: UserRole) => {
        if (isMandatoryAdminEmail(email) && newRole !== 'admin') {
            setError('No puedes cambiar el rol de un administrador obligatorio');
            return;
        }

        const roles = loadUserRoles();
        roles[email.toLowerCase()] = newRole;
        saveUserRoles(roles);

        const managedUser = users.find((u) => u.email === email.toLowerCase());
        try {
            await upsertRemoteProfile({
                email,
                role: newRole,
                firstName: managedUser?.firstName || '',
                lastName: managedUser?.lastName || ''
            });
        } catch {
            // mantenemos fallback local
        }

        appendAuditLog({
            scope: 'admin',
            action: 'change_role',
            actor: 'admin',
            target: email,
            details: `Rol actualizado a ${newRole}`
        });
        void loadUsers();
        setSuccess(`Rol de ${email} cambiado a ${ROLE_LABELS[newRole]}`);
    };

    const handleRemoveUser = (email: string) => {
        if (isMandatoryAdminEmail(email)) {
            setError('No puedes eliminar un administrador obligatorio');
            return;
        }

        const roles = loadUserRoles();
        delete roles[email.toLowerCase()];
        saveUserRoles(roles);

        const profiles = loadUserProfiles();
        delete profiles[email.toLowerCase()];
        saveUserProfiles(profiles);

        const passwords = loadUserPasswords();
        delete passwords[email.toLowerCase()];
        saveUserPasswords(passwords);

        const security = loadUserSecurity();
        delete security[email.toLowerCase()];
        saveUserSecurity(security);

        appendAuditLog({
            scope: 'admin',
            action: 'remove_user',
            actor: 'admin',
            target: email,
            details: 'Usuario eliminado del panel'
        });

        void loadUsers();
        setSuccess(`Usuario ${email} eliminado de la gestión de roles`);
    };

    const handleProfileDraftChange = (email: string, field: 'firstName' | 'lastName', value: string) => {
        setProfileDrafts((prev) => ({
            ...prev,
            [email]: {
                ...(prev[email] || { firstName: '', lastName: '' }),
                [field]: value
            }
        }));
    };

    const handleSaveProfile = async (email: string) => {
        const draft = profileDrafts[email] || { firstName: '', lastName: '' };
        const firstName = draft.firstName.trim();
        const lastName = draft.lastName.trim();

        if (!firstName || !lastName) {
            setError('Nombre y apellido no pueden quedar vacíos');
            return;
        }

        const normalizedEmail = email.toLowerCase();
        const userRole = (users.find((u) => u.email === normalizedEmail)?.role || 'reader') as UserRole;

        setError(null);
        setSuccess(null);

        try {
            await upsertRemoteProfile({ email: normalizedEmail, role: userRole, firstName, lastName });
        } catch (err: any) {
            console.error('Save Profile Error:', err);
            const detail = String(err?.message || '').trim();
            setError(detail
                ? `Error de permisos: ${detail}. Asegúrate de haber ejecutado el script SQL de configuración en Supabase.`
                : 'No se pudo guardar en la nube. Verifica que tu usuario sea Administrador en la tabla "profiles" o ejecuta el script SQL.');
            return;
        }

        const profiles = loadUserProfiles();
        profiles[normalizedEmail] = { firstName, lastName };
        saveUserProfiles(profiles);

        appendAuditLog({
            scope: 'admin',
            action: 'update_profile',
            actor: 'admin',
            target: normalizedEmail,
            details: `Nombre actualizado a ${firstName} ${lastName}`
        });
        void loadUsers();
        setSuccess(`Datos actualizados para ${normalizedEmail}`);
    };

    const handleResetPassword = async (email: string) => {
        const normalized = email.toLowerCase();
        setError(null);
        setSuccess(null);
        setIsResettingByEmail((prev) => ({ ...prev, [normalized]: true }));

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalized, {
                redirectTo: `${window.location.origin}/reset-password`
            });

            if (resetError) {
                throw resetError;
            }

            updateUserSecurity(normalized, { forcePasswordChange: false });
            appendAuditLog({
                scope: 'admin',
                action: 'reset_password_email',
                actor: 'admin',
                target: normalized,
                details: 'Envio de email de restablecimiento'
            });

            setSuccess(`Se envió un enlace de restablecimiento de contraseña a ${normalized}`);
        } catch (err: any) {
            setError(err.message || 'No se pudo iniciar el restablecimiento de contraseña');
        } finally {
            setIsResettingByEmail((prev) => ({ ...prev, [normalized]: false }));
        }
    };

    const handlePasswordDraftChange = (email: string, value: string) => {
        setPasswordDrafts((prev) => ({ ...prev, [email]: value }));
    };

    const handleSavePasswordReference = (email: string) => {
        const password = String(passwordDrafts[email] || '').trim();
        if (password.length < 6) {
            setError('La contraseña registrada debe tener al menos 6 caracteres');
            return;
        }

        const passwords = loadUserPasswords();
        passwords[email.toLowerCase()] = password;
        saveUserPasswords(passwords);
        appendAuditLog({
            scope: 'admin',
            action: 'save_password_reference',
            actor: 'admin',
            target: email,
            details: 'Actualización de contraseña registrada en panel'
        });
        void loadUsers();
        setSuccess(`Contraseña registrada actualizada para ${email}`);
    };

    const togglePasswordVisibility = (email: string) => {
        setShowPasswordByEmail((prev) => ({ ...prev, [email]: !prev[email] }));
    };

    const handleToggleBlocked = (email: string, blocked: boolean) => {
        if (isMandatoryAdminEmail(email)) {
            setError('No puedes bloquear un administrador obligatorio');
            return;
        }

        updateUserSecurity(email, { blocked });
        appendAuditLog({
            scope: 'admin',
            action: blocked ? 'block_user' : 'unblock_user',
            actor: 'admin',
            target: email,
            details: blocked ? 'Cuenta bloqueada' : 'Cuenta desbloqueada'
        });
        void loadUsers();
        setSuccess(blocked ? `Usuario ${email} bloqueado` : `Usuario ${email} desbloqueado`);
    };

    const handleToggleForcePasswordChange = (email: string, forcePasswordChange: boolean) => {
        if (isMandatoryAdminEmail(email)) {
            setError('No puedes forzar cambio de contraseña para un administrador obligatorio');
            return;
        }

        updateUserSecurity(email, { forcePasswordChange });
        appendAuditLog({
            scope: 'admin',
            action: forcePasswordChange ? 'force_password_change_on' : 'force_password_change_off',
            actor: 'admin',
            target: email,
            details: forcePasswordChange ? 'Cambio de contraseña obligatorio activado' : 'Cambio de contraseña obligatorio desactivado'
        });
        void loadUsers();
        setSuccess(forcePasswordChange
            ? `Se exigirá cambio de contraseña a ${email}`
            : `Se quitó la exigencia de cambio para ${email}`);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <ShieldAlert className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white">Panel de Control IT</h2>
                            <p className="text-xs text-white/70">Gestión de seguridad y datos</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 m-4 rounded-2xl border border-slate-200 dark:border-slate-700 shrink-0">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'users'
                            ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        <Users size={14} />
                        Usuarios
                    </button>
                    <button
                        onClick={() => setActiveTab('audit')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'audit'
                            ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        <History size={14} />
                        Historial
                    </button>
                    <button
                        onClick={() => setActiveTab('data_audit')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'data_audit'
                            ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        <ShieldCheck size={14} />
                        Auditor Datos
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-6 custom-scrollbar">
                    {activeTab === 'users' ? (
                        <>
                            {/* ALERTS */}
                            {error && (
                                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                                </div>
                            )}
                            {success && (
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                    <p className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p>
                                </div>
                            )}

                            {/* CREAR USUARIO */}
                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center gap-2 mb-4">
                                    <UserPlus className="w-4 h-4 text-indigo-500" />
                                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Crear Nuevo Usuario</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <input
                                        type="text"
                                        placeholder="Nombre"
                                        value={createFirstName}
                                        onChange={(e) => setCreateFirstName(e.target.value)}
                                        className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Apellido"
                                        value={createLastName}
                                        onChange={(e) => setCreateLastName(e.target.value)}
                                        className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="email"
                                            placeholder="Email"
                                            value={createEmail}
                                            onChange={(e) => setCreateEmail(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div className="relative">
                                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type={showCreatePassword ? 'text' : 'password'}
                                            placeholder="Contraseña"
                                            value={createPassword}
                                            onChange={(e) => setCreatePassword(e.target.value)}
                                            className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                        <button
                                            onClick={() => setShowCreatePassword(!showCreatePassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                                        >
                                            {showCreatePassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                    <select
                                        value={createRole}
                                        onChange={(e) => setCreateRole(e.target.value as UserRole)}
                                        className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="reader">Lector</option>
                                        <option value="editor">Editor</option>
                                        <option value="admin">Administrador</option>
                                    </select>
                                    <button
                                        onClick={handleCreateUser}
                                        disabled={isCreating}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                                    >
                                        {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus size={16} />}
                                        Crear
                                    </button>
                                </div>
                            </div>

                            {/* LISTA DE USUARIOS */}
                            <div className="space-y-4">
                                {users.map((user) => (
                                    <div key={user.email} className="p-4 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${user.role === 'admin' ? 'bg-purple-100 dark:bg-purple-900/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                                    {user.role === 'admin' ? <Crown className="w-5 h-5 text-purple-600" /> : <Users className="w-5 h-5 text-slate-500" />}
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-900 dark:text-white">{user.firstName} {user.lastName}</p>
                                                    <p className="text-xs text-slate-500">{user.email}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveUser(user.email)}
                                                className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <select
                                                value={user.role}
                                                onChange={(e) => handleChangeRole(user.email, e.target.value as UserRole)}
                                                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-black uppercase"
                                            >
                                                <option value="reader">Lector</option>
                                                <option value="editor">Editor</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                            <button
                                                onClick={() => handleResetPassword(user.email)}
                                                className="px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 text-xs font-black uppercase rounded-xl"
                                                disabled={isResettingByEmail[user.email]}
                                            >
                                                Reset Password
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : activeTab === 'audit' ? (
                        <div className="space-y-4">
                            <div className="relative mb-4">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar en el historial..."
                                    value={auditSearch}
                                    onChange={(e) => setAuditSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-900/50 border-none rounded-xl text-sm"
                                />
                            </div>
                            <div className="space-y-3">
                                {remoteAuditLogs
                                    .filter(e => e.actor.toLowerCase().includes(auditSearch.toLowerCase()) || e.action.toLowerCase().includes(auditSearch.toLowerCase()))
                                    .map((entry) => (
                                        <div key={entry.id} className="p-4 bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md">
                                                    {entry.action}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-bold">
                                                    {new Date(entry.timestamp).toLocaleString('es-CL')}
                                                </span>
                                            </div>
                                            <p className="text-xs font-black text-slate-800 dark:text-slate-100">{entry.target}</p>
                                            <p className="text-[10px] text-slate-500 mt-1">Por: {entry.actor}</p>
                                            {entry.details && <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg italic">{entry.details}</p>}
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ) : (
                        <DataAuditorView
                            records={records}
                            employees={employees}
                            onSelectRecord={(record) => {
                                onClose();
                                onSelectRecord?.(record);
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;
