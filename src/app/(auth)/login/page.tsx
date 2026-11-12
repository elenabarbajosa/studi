import { AuthForm } from "@/components/auth/auth-form";

export const instant = false;

export const metadata = {
  title: "Sign in",
};

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstString(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextParam = firstString(params.next);
  const next =
    nextParam && nextParam.startsWith("/") ? nextParam : "/dashboard";

  return (
    <AuthForm
      mode="login"
      nextPath={next}
      bannerError={firstString(params.error)}
      bannerNotice={firstString(params.notice)}
    />
  );
}
