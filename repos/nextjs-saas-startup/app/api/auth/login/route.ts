import { NextResponse, type NextRequest } from "next/server";
import { startSession } from "@/lib/auth";
import { findUserByEmail } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url), 303);
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  const user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return redirectTo(request, "/login?error=invalid_credentials");
  }

  await startSession(user.id);
  return redirectTo(request, "/dashboard");
}
