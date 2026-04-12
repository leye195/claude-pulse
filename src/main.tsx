import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import { PopoverApp } from "@/features/popover";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: true,
    },
  },
});

const isPopover = new URLSearchParams(window.location.search).get("popover") === "1";
if (isPopover) {
  document.documentElement.classList.add("popover-mode");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {isPopover ? <PopoverApp /> : <App />}
    </QueryClientProvider>
  </StrictMode>
);
