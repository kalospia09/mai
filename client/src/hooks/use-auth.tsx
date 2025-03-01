import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<{ user: SelectUser; token: string }, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
};

type LoginData = Pick<InsertUser, "username" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  // Get token from localStorage
  const token = localStorage.getItem('authToken');

  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | null, Error>({
    queryKey: ["/api/user"],
    queryFn: async ({ queryKey }) => {
      if (!token) return null;
      const res = await fetch(queryKey[0] as string, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.status === 401) return null;
      const throwIfResNotOk = (res: Response) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
      };
      await throwIfResNotOk(res);
      return res.json();
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (data: { user: SelectUser; token: string }) => {
      localStorage.setItem('authToken', data.token);
      queryClient.setQueryData(["/api/user"], data.user);
      toast({
        title: "Success",
        description: "Successfully logged in",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('authToken');
      if (token) {
        await apiRequest("POST", "/api/logout", undefined, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    },
    onSuccess: () => {
      localStorage.removeItem('authToken');
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Success",
        description: "Successfully logged out",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}