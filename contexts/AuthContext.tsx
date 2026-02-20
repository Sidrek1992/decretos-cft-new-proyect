import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserRole, Permissions, getPermissions, hasPermission, ROLE_LABELS, ROLE_COLORS } from '../types/roles';
import { appendAuditLog } from '../utils/audit';
import { getUserSecurityByEmail, isMandatoryAdminEmail, loadUserRoles, touchUserLastAccess, updateUserSecurity } from '../utils/userAdminStorage';
import { subscribeToProfileChanges } from '../services/realtimeSync';

interface UserProfile {
    id: string;
    email: string;
    role: UserRole;
    firstName: string;
    lastName: string;
    created_at: string;
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    profile: UserProfile | null;
    role: UserRole;
    permissions: Permissions;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
    signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
    hasPermission: (permission: keyof Permissions) => boolean;
    roleLabel: string;
    roleColors: { bg: string; text: string };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth debe usarse dentro de un AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: React.ReactNode;
}

const getEnforcedRoleByEmail = (email: string | undefined): UserRole | null => {
    if (!email) return null;
    return isMandatoryAdminEmail(email) ? 'admin' : null;
};

const getRoleFromEmail = (email: string | undefined): UserRole => {
    if (!email) return 'reader';
    const roles = loadUserRoles();
    return roles[email.toLowerCase()] || 'reader';
};

const resolveRoleFromMetadata = (metadata: Record<string, unknown> | null | undefined): UserRole | null => {
    if (!metadata) return null;
    const rawRole = String(metadata.role || '').toLowerCase();
    if (rawRole === 'admin' || rawRole === 'editor' || rawRole === 'reader') return rawRole as UserRole;
    return null;
};

const clearWelcomeBannerDismissals = (): void => {
    try {
        const keysToRemove = Object.keys(localStorage).filter(key => key.startsWith('gdp-banner-dismissed-'));
        keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch {
        // ignore storage errors in non-browser or restricted contexts
    }
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // Calcular rol basado en el perfil o email
    const role: UserRole =
        getEnforcedRoleByEmail(user?.email) ||
        profile?.role ||
        resolveRoleFromMetadata(user?.user_metadata as Record<string, unknown> | undefined) ||
        getRoleFromEmail(user?.email);
    const permissions = getPermissions(role);
    const roleLabel = ROLE_LABELS[role];
    const roleColors = ROLE_COLORS[role];

    const checkPermission = (permission: keyof Permissions): boolean => {
        return hasPermission(role, permission);
    };

    // Cargar perfil desde Supabase para persistir rol entre dispositivos
    const loadProfile = useCallback(async (userId: string, email?: string): Promise<void> => {
        const normalizedEmail = email?.trim().toLowerCase();
        if (!normalizedEmail) {
            setProfile(null);
            return;
        }

        try {
            // timeout de 5 segundos para la carga del perfil remoto
            const profilePromise = supabase
                .from('profiles')
                .select('email, role, first_name, last_name, created_at')
                .eq('email', normalizedEmail)
                .maybeSingle();

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout loading profile')), 5000)
            );

            const { data, error } = await Promise.race([profilePromise, timeoutPromise]) as any;

            if (!error && data?.role) {
                const dbRole = String(data.role).toLowerCase();
                const normalizedRole: UserRole = dbRole === 'admin' || dbRole === 'editor' || dbRole === 'reader'
                    ? (dbRole as UserRole)
                    : 'reader';
                setProfile({
                    id: userId,
                    email: data.email,
                    role: normalizedRole,
                    firstName: String(data.first_name || '').trim(),
                    lastName: String(data.last_name || '').trim(),
                    created_at: String(data.created_at || new Date().toISOString())
                });
                console.log('Auth: Perfil cargado exitosamente desde DB');
                return;
            }
            if (error) console.error('Auth: Error en consulta de perfil:', error);
        } catch (err) {
            console.warn('Auth: No se pudo cargar perfil remoto (usando fallback local):', err);
        }

        setProfile(null);
    }, []);

    useEffect(() => {
        // Obtener sesión actual
        const getSession = async () => {
            console.log('Auth: Iniciando verificación de sesión...');
            try {
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error('Auth: Error obteniendo sesión:', error);
                    setLoading(false);
                    return;
                }

                if (session?.user?.email && getUserSecurityByEmail(session.user.email).blocked) {
                    console.warn('Auth: Usuario bloqueado:', session.user.email);
                    await supabase.auth.signOut();
                    setSession(null);
                    setUser(null);
                    setLoading(false);
                    return;
                }

                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    console.log('Auth: Sesión encontrada para', session.user.email, '- Cargando perfil...');
                    await loadProfile(session.user.id, session.user.email);
                } else {
                    console.log('Auth: No se encontró sesión activa');
                }
            } catch (err) {
                console.error('Auth: Error crítico en getSession:', err);
            } finally {
                setLoading(false);
                console.log('Auth: Verificación de sesión finalizada.');
            }
        };

        getSession();

        // Escuchar cambios de autenticación
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('Auth: Cambio de estado detectado:', event);
                try {
                    if (session?.user?.email && getUserSecurityByEmail(session.user.email).blocked) {
                        await supabase.auth.signOut();
                        setSession(null);
                        setUser(null);
                        setProfile(null);
                        setLoading(false);
                        return;
                    }

                    setSession(session);
                    setUser(session?.user ?? null);

                    if (session?.user) {
                        await loadProfile(session.user.id, session.user.email);
                    } else {
                        setProfile(null);
                        if (event === 'SIGNED_OUT') {
                            clearWelcomeBannerDismissals();
                        }
                    }
                } catch (err) {
                    console.error('Auth: Error en handler de onAuthStateChange:', err);
                } finally {
                    setLoading(false);
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [loadProfile]);

    useEffect(() => {
        if (!user?.id || !user?.email) return;

        const unsubscribe = subscribeToProfileChanges({
            channelKey: 'auth-context',
            email: user.email,
            onChange: () => {
                void loadProfile(user.id, user.email);
            }
        });

        return () => {
            unsubscribe();
        };
    }, [user?.id, user?.email, loadProfile]);

    const signIn = async (email: string, password: string) => {
        const normalizedEmail = email.trim().toLowerCase();
        const securityBeforeSignIn = getUserSecurityByEmail(normalizedEmail);
        if (securityBeforeSignIn.blocked) {
            return {
                error: {
                    name: 'AuthApiError',
                    message: 'Tu cuenta está bloqueada. Contacta al administrador.'
                } as AuthError
            };
        }

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (!error) {
            touchUserLastAccess(normalizedEmail);
            appendAuditLog({
                scope: 'auth',
                action: 'login_success',
                actor: normalizedEmail,
                target: normalizedEmail,
                details: 'Inicio de sesión exitoso'
            });

            const security = getUserSecurityByEmail(normalizedEmail);
            if (security.forcePasswordChange) {
                await supabase.auth.signOut();
                const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
                    redirectTo: `${window.location.origin}/reset-password`,
                });

                if (!resetError) {
                    appendAuditLog({
                        scope: 'auth',
                        action: 'force_password_change_triggered',
                        actor: normalizedEmail,
                        target: normalizedEmail,
                        details: 'Se forzó cambio de contraseña con email de recuperación'
                    });
                }

                return {
                    error: {
                        name: 'AuthApiError',
                        message: 'Debes cambiar tu contraseña antes de ingresar. Revisa tu correo para continuar.'
                    } as AuthError
                };
            }
        }
        return { error };
    };

    const signUp = async (email: string, password: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
        });
        return { error };
    };

    const signOut = async () => {
        if (user?.email) {
            appendAuditLog({
                scope: 'auth',
                action: 'logout',
                actor: user.email,
                target: user.email,
                details: 'Cierre de sesión'
            });
        }
        setProfile(null);
        clearWelcomeBannerDismissals();
        await supabase.auth.signOut();
    };

    const resetPassword = async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });
        if (!error) {
            updateUserSecurity(email, { forcePasswordChange: false });
        }
        return { error };
    };

    const value: AuthContextType = {
        user,
        session,
        profile,
        role,
        permissions,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        hasPermission: checkPermission,
        roleLabel,
        roleColors,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
