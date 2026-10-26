"use client";

import { Field, PageIntro, TextField } from "@/components/bits";
import { InlineError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { getSupabase } from "@/lib/sync/client";
import { plainAuthError } from "@/lib/sync/auth-errors";
import { normalizeEmail } from "@/lib/sync/config";
import { patchSync, getSyncSnapshot, subscribeSync } from "@/lib/sync/status";
import { AppLink as Link, useAppRouter as useRouter } from "@/components/app-link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

export function SignInScreen() {
  const router = useRouter();
  const snapshot = useSyncExternalStore(subscribeSync, getSyncSnapshot, getSyncSnapshot);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const armed = useRef(false);
  const message = formError || snapshot.lastError;

  useEffect(() => {
    if (!armed.current) return;
    if (snapshot.lastError) {
      armed.current = false;
      return;
    }
    if (snapshot.email) {
      armed.current = false;
      router.replace("/");
    }
  }, [router, snapshot.email, snapshot.lastError]);

  function switchMode(next: "sign-in" | "sign-up") {
    setMode(next);
    setPassword("");
    setConfirm("");
    setFormError(null);
    patchSync({ lastError: null });
  }

  async function onSubmit() {
    setFormError(null);
    patchSync({ lastError: null });
    const address = normalizeEmail(email);
    if (!address.includes("@")) {
      setFormError("Enter the email Mat set up for you.");
      return;
    }
    if (password.length < 8) {
      setFormError("Use a password of at least 8 characters.");
      return;
    }
    if (mode === "sign-up" && password !== confirm) {
      setFormError("Those passwords don't match.");
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setFormError("Sign-in is not available in this browser.");
      return;
    }
    setBusy(true);
    armed.current = true;
    if (mode === "sign-up") {
      const { data, error } = await supabase.auth.signUp({ email: address, password });
      setBusy(false);
      if (error) {
        armed.current = false;
        setFormError(plainAuthError(error.message));
        return;
      }
      const identities = data.user?.identities;
      if (!data.session && Array.isArray(identities) && identities.length === 0) {
        armed.current = false;
        setFormError("That email already has a login. Sign in instead.");
        return;
      }
      if (!data.session) {
        armed.current = false;
        setFormError("This phone did not finish signing in. Ask Mat.");
      }
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: address, password });
    setBusy(false);
    if (error) {
      armed.current = false;
      setFormError(plainAuthError(error.message));
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-md gap-5">
      <PageIntro
        eyebrow="Shared book"
        title={mode === "sign-up" ? "Create my login" : "Sign in"}
        description="Use the email Mat set up. The password stays on this phone. You can keep working with no sign-in."
      />
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <Field label="Email">
          <TextField
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
          />
        </Field>
        <PasswordField
          label="Password"
          value={password}
          shown={showPassword}
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          onChange={setPassword}
          onToggle={() => setShowPassword((value) => !value)}
        />
        {mode === "sign-up" ? (
          <PasswordField
            label="Confirm password"
            value={confirm}
            shown={showPassword}
            autoComplete="new-password"
            onChange={setConfirm}
            onToggle={() => setShowPassword((value) => !value)}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Forgot your password? Ask Mat.</p>
        )}
        <InlineError message={message} />
        <Button type="submit" disabled={busy}>
          {mode === "sign-up" ? "Create my login" : "Sign in"}
        </Button>
        {mode === "sign-in" ? (
          <Button type="button" variant="link" className="h-12 text-base" onClick={() => switchMode("sign-up")}>
            First time? Create my login
          </Button>
        ) : (
          <Button type="button" variant="link" className="h-12 text-base" onClick={() => switchMode("sign-in")}>
            Already have a login? Sign in
          </Button>
        )}
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          Use this phone without signing in
        </Button>
      </form>
    </div>
  );
}

function PasswordField({
  label,
  value,
  shown,
  autoComplete,
  onChange,
  onToggle,
}: {
  label: string;
  value: string;
  shown: boolean;
  autoComplete: string;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <TextField
            type={shown ? "text" : "password"}
            autoComplete={autoComplete}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
        <Button type="button" variant="outline" className="shrink-0" onClick={onToggle} aria-pressed={shown}>
          {shown ? "Hide" : "Show"}
        </Button>
      </div>
    </Field>
  );
}
