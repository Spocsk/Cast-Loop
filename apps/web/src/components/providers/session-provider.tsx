"use client";

import { AuthenticatedAppUser, OrganizationSummary, SessionMembership } from "@cast-loop/shared";
import { Session } from "@supabase/supabase-js";
import {
  createContext,
  ReactNode,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { fetchOrganizations, setActiveOrganization, validateAppSession } from "@/lib/api";
import { hasSupabaseClientEnv } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

interface SessionContextValue {
  status: SessionStatus;
  accessToken: string | null;
  session: Session | null;
  user: AuthenticatedAppUser | null;
  memberships: SessionMembership[];
  organizations: OrganizationSummary[];
  activeOrganizationId: string | null;
  activeOrganization: OrganizationSummary | null;
  error: string | null;
  refreshSession: () => Promise<void>;
  setActiveOrganization: (organizationId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const initialState: Omit<SessionContextValue, "refreshSession" | "setActiveOrganization" | "signOut"> = {
  status: "loading",
  accessToken: null,
  session: null,
  user: null,
  memberships: [],
  organizations: [],
  activeOrganizationId: null,
  activeOrganization: null,
  error: null
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [state, setState] = useState(initialState);

  const syncSession = async (session: Session | null) => {
    if (!supabase || !hasSupabaseClientEnv) {
      setState({
        ...initialState,
        status: "unauthenticated",
        error: "Configuration Supabase manquante."
      });
      return;
    }

    if (!session) {
      setState({
        ...initialState,
        status: "unauthenticated"
      });
      return;
    }

    setState((current) => ({
      ...current,
      status: "loading",
      session,
      accessToken: session.access_token,
      error: null
    }));

    try {
      const validatedSession = await validateAppSession(session.access_token);

      startTransition(() => {
        setState({
          status: "authenticated",
          session,
          accessToken: session.access_token,
          user: validatedSession.user,
          memberships: validatedSession.memberships,
          organizations: [],
          activeOrganizationId: validatedSession.activeOrganizationId,
          activeOrganization: null,
          error: null
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de valider la session.";

      startTransition(() => {
        setState({
          ...initialState,
          status: "unauthenticated",
          error: message
        });
      });
    }
  };

  useEffect(() => {
    if (!supabase || !hasSupabaseClientEnv) {
      setState({
        ...initialState,
        status: "unauthenticated",
        error: "Configuration Supabase manquante."
      });
      return;
    }

    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      void syncSession(data.session);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      void syncSession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (state.status !== "authenticated" || !state.accessToken) {
      return;
    }

    let active = true;

    void fetchOrganizations(state.accessToken)
      .then((organizations) => {
        if (!active) return;

        startTransition(() => {
          setState((current) => {
            const activeOrganization =
              organizations.find((organization) => organization.id === current.activeOrganizationId) ?? null;

            return {
              ...current,
              organizations,
              activeOrganization
            };
          });
        });
      })
      .catch((error) => {
        if (!active) return;

        startTransition(() => {
          setState((current) => ({
            ...current,
            organizations: [],
            activeOrganization: null,
            error: error instanceof Error ? error.message : "Impossible de charger les organisations."
          }));
        });
      });

    return () => {
      active = false;
    };
  }, [state.accessToken, state.activeOrganizationId, state.status]);

  const value: SessionContextValue = {
    ...state,
    refreshSession: async () => {
      if (!supabase) return;
      const {
        data: { session }
      } = await supabase.auth.getSession();
      await syncSession(session);
    },
    setActiveOrganization: async (organizationId: string) => {
      if (!state.accessToken || state.activeOrganizationId === organizationId) {
        return;
      }

      const validatedSession = await setActiveOrganization(state.accessToken, { organizationId });

      startTransition(() => {
        setState((current) => ({
          ...current,
          memberships: validatedSession.memberships,
          activeOrganizationId: validatedSession.activeOrganizationId,
          activeOrganization:
            current.organizations.find((organization) => organization.id === validatedSession.activeOrganizationId) ?? null,
          error: null
        }));
      });
    },
    signOut: async () => {
      if (!supabase) return;
      await supabase.auth.signOut();
      setState({
        ...initialState,
        status: "unauthenticated"
      });
    }
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSessionContext = () => {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSessionContext must be used inside SessionProvider");
  }

  return context;
};
