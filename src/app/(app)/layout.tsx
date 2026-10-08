import { Providers } from "@/components/providers";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
