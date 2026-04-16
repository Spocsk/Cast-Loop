"use client";

import { AuthenticatedAppUser, OrganizationRole } from "@cast-loop/shared";
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
import { validateAppSession } from "@/lib/api";
import { hasSupabaseClientEnv } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Membership {
  organizationId: string;
  role: OrganizationRole;
}

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

interface SessionContextValue {
  status: SessionStatus;
  accessToken: string | null;
  session: Session | null;
  user: AuthenticatedAppUser | null;
  memberships: Membership[];
  activeOrganizationId: string | null;
  error: string | null;
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const initialState: Omit<SessionContextValue, "refreshSession"> = {
  status: "loading",
  accessToken: null,
  session: null,
  user: null,
  memberships: [],
  activeOrganizationId: null,
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
          activeOrganizationId: validatedSession.activeOrganizationId,
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

  const value: SessionContextValue = {
    ...state,
    refreshSession: async () => {
      if (!supabase) return;
      const {
        data: { session }
      } = await supabase.auth.getSession();
      await syncSession(session);
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
