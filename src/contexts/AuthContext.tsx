import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "system_admin"
  | "board" | "executive" | "assistant" | "project_manager"
  | "branch_manager" | "employee" | "contractor" | "participant" | "guardian";

export type AccessLevel = 'system' | 'company' | 'project' | 'none';

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
  username: string | null;
  display_name_ar: string | null;
  display_name_en: string | null;
  is_password_setup_required: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  permissions: Set<string>;
  
  // Workspace properties
  userCompanies: string[];
  userProjects: string[];
  accessLevel: AccessLevel;

  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  hasPermission: (permission: string) => boolean;
  isSystemAdmin: boolean;
  isAdmin: boolean;
  actualIsSystemAdmin: boolean;
  activeRole: AppRole | null;
  
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const LOAD_TIMEOUT = 8000;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<Profile | null>(null);
  
  // Workspace state
  const [userCompanies, setUserCompanies] = useState<string[]>([]);
  const [userProjects, setUserProjects] = useState<string[]>([]);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('none');

  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  const loadProfile = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, email, phone, username, display_name_ar, display_name_en, is_password_setup_required")
        .eq("id", uid)
        .maybeSingle();
      
      if (error) {
        console.error("[Auth] Failed to load profile:", error.message);
        return;
      }
      setProfile(data as Profile);
    } catch (error) {
      console.error("[Auth] Profile load exception:", error);
    }
  };

  const loadRolesAndWorkspace = async (uid: string) => {
    try {
      // 1. Load system roles
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      
      const VALID_ROLES: AppRole[] = [
        "system_admin", "board", "executive", "assistant", "project_manager",
        "branch_manager", "employee", "contractor", "participant", "guardian"
      ];
      
      const list = (userRoles ?? [])
        .map((r) => r.role as AppRole)
        .filter((r) => VALID_ROLES.includes(r));
        
      setRoles(list);
      const isSysAdmin = list.includes("system_admin");

      // 2. Load permissions
      const permSet = new Set<string>();
      try {
        const [{ data: rolePerms }, { data: userPerms }] = await Promise.all([
          supabase.from("role_permissions").select("role, permission_key"),
          supabase.from("user_permissions").select("permission_key, granted").eq("user_id", uid)
        ]);

        if (rolePerms) {
          rolePerms.forEach((rp) => {
            if (list.includes(rp.role as AppRole)) {
              permSet.add(rp.permission_key);
            }
          });
        }
        if (userPerms) {
          userPerms.forEach((up) => {
            if (up.granted) permSet.add(up.permission_key);
            else permSet.delete(up.permission_key);
          });
        }
      } catch (err) {
        console.warn("[Auth] Permissions load failed", err);
      }
      setPermissions(permSet);

      // 3. Load workspace affiliations
      try {
        const [{ data: compData }, { data: projData }] = await Promise.all([
          supabase.from("company_members").select("company_id").eq("user_id", uid),
          supabase.from("project_members").select("project_id").eq("user_id", uid)
        ]);
        
        const companies = (compData ?? []).map(c => c.company_id);
        const projects = (projData ?? []).map(p => p.project_id);
        
        setUserCompanies(companies);
        setUserProjects(projects);

        // Determine Access Level
        if (isSysAdmin) {
          setAccessLevel('system');
        } else if (companies.length > 0) {
          setAccessLevel('company');
        } else if (projects.length > 0) {
          setAccessLevel('project');
        } else {
          setAccessLevel('none');
        }

      } catch (workspaceError) {
         console.warn("[Auth] Workspace affiliations load failed. The backend tables might not be migrated yet.");
         // If tables don't exist yet, fallback to roles
         if (isSysAdmin) setAccessLevel('system');
         else if (list.length > 0 && !list.includes('participant')) setAccessLevel('company'); // fallback
      }

    } catch (error) {
      console.error("[Auth] Roles load exception:", error);
      setRoles([]);
      setPermissions(new Set());
      setAccessLevel('none');
    }
  };

  const loadUserData = async (uid: string) => {
    const timeout = new Promise<void>((resolve) => {
      setTimeout(() => {
        console.warn("[Auth] Load timeout reached, continuing without full data.");
        resolve();
      }, LOAD_TIMEOUT);
    });

    const dataLoad = Promise.all([loadRolesAndWorkspace(uid), loadProfile(uid)]).then(() => {});
    await Promise.race([dataLoad, timeout]);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: sess } }) => {
      if (initializedRef.current) return;
      initializedRef.current = true;

      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        await loadUserData(sess.user.id);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      if (!initializedRef.current) return;
      setSession(sess);
      setUser(sess?.user ?? null);

      if (sess?.user) {
        setLoading(true);
        await loadUserData(sess.user.id);
        setLoading(false);
      } else {
        setRoles([]);
        setProfile(null);
        setPermissions(new Set());
        setUserCompanies([]);
        setUserProjects([]);
        setAccessLevel('none');
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const isSystemAdmin = roles.includes("system_admin");

  const value: AuthContextValue = {
    session, user, profile, roles, permissions,
    userCompanies, userProjects, accessLevel,
    loading,
    hasRole: (r) => isSystemAdmin || roles.includes(r),
    hasAnyRole: (rs) => isSystemAdmin || rs.some((r) => roles.includes(r)),
    hasPermission: (p) => {
      if (isSystemAdmin || permissions.has("*") || permissions.has(p)) return true;
      
      // If checking for a specific CRUD permission, check if they have full management permission
      if (p.startsWith("create_") || p.startsWith("update_") || p.startsWith("delete_")) {
        const action = p.split("_")[0];
        const base = p.substring(action.length + 1);
        if (permissions.has(`manage_${base}`)) return true;
      }
      
      // If checking for management permission, check if they have any of the specific CRUD permissions
      if (p.startsWith("manage_")) {
        const base = p.replace("manage_", "");
        return permissions.has(`create_${base}`) || permissions.has(`update_${base}`) || permissions.has(`delete_${base}`);
      }
      
      return false;
    },
    isSystemAdmin,
    isAdmin: isSystemAdmin || roles.includes("executive") || roles.includes("assistant"),
    actualIsSystemAdmin: isSystemAdmin,
    activeRole: roles.length > 0 ? roles[0] : null,
    signOut: async () => {
      // Call network sign out first per requirements
      await supabase.auth.signOut();
      // Then clear local state
      setSession(null);
      setUser(null);
      setRoles([]);
      setProfile(null);
      setPermissions(new Set());
      setUserCompanies([]);
      setUserProjects([]);
      setAccessLevel('none');
    },
    refreshRoles: async () => { if (user) await loadRolesAndWorkspace(user.id); },
    refreshProfile: async () => { if (user) await loadProfile(user.id); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
