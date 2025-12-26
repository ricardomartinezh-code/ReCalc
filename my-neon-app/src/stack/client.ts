import { StackClientApp } from "@stackframe/react";
import { useNavigate } from "react-router-dom";

const projectId = import.meta.env.NEXT_PUBLIC_STACK_PROJECT_ID ?? "";
const publishableClientKey =
  import.meta.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY ?? "";

export const stackClientApp = new StackClientApp({
  tokenStore: "cookie",
  projectId,
  publishableClientKey,
  redirectMethod: {
    useNavigate,
  },
});
