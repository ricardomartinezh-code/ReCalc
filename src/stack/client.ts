import { StackClientApp } from "@stackframe/react";
import { useNavigate } from "react-router-dom";

const projectId =
  import.meta.env.VITE_STACK_PROJECT_ID ??
  import.meta.env.NEXT_PUBLIC_STACK_PROJECT_ID ??
  "";
const publishableClientKey =
  import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY ??
  import.meta.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY ??
  "";

export const stackClientApp = new StackClientApp({
  tokenStore: "cookie",
  projectId,
  publishableClientKey,
  redirectMethod: {
    useNavigate,
  },
});
