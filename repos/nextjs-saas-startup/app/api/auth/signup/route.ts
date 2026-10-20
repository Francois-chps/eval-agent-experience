import { NextResponse, type NextRequest } from "next/server";
import { startSession } from "@/lib/auth";
import { createAccount, findUserByEmail } from "@/lib/db";

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url), 303);
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const restaurantName = String(form.get("restaurantName") ?? "").trim();
  const city = String(form.get("city") ?? "").trim();

  if (!name || !email.includes("@") || password.length < 8 || !restaurantName || !city) {
    return redirectTo(request, "/signup?error=invalid");
  }

  if (await findUserByEmail(email)) {
    return redirectTo(request, "/signup?error=email_taken");
  }

  const user = await createAccount({ name, email, password, restaurantName, city });
  await startSession(user.id);

  return redirectTo(request, "/dashboard");
}
