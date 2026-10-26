import { ClientRoutes } from "@/components/client-routes";

export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string[] }> {
  return [
    { slug: [] as string[] },
    { slug: ["crew"] },
    { slug: ["data"] },
    { slug: ["contacts"] },
    { slug: ["sign-in"] },
    { slug: ["projects", "new"] },
  ];
}

export default function Page() {
  return <ClientRoutes />;
}
