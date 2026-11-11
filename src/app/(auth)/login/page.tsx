import { AuthForm } from "@/components/auth/auth-form";

export const instant = false;

export const metadata = {
  title: "Sign in",
};

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next =
    typeof params.next === "string" && params.next.startsWith("/")
      ? params.next
      : "/dashboard";

  return <AuthForm mode="login" nextPath={next} />;
}
