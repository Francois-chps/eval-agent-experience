const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Please fill in every field. Passwords need at least 8 characters.",
  email_taken: "An account already exists with this email address.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? (ERROR_MESSAGES[error] ?? "Something went wrong.") : null;

  return (
    <main className="card">
      <h1>Create your account</h1>
      {message && <p className="error">{message}</p>}
      <form action="/api/auth/signup" method="post" className="form">
        <label>
          Your name
          <input name="name" type="text" autoComplete="name" required />
        </label>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <label>
          Restaurant name
          <input name="restaurantName" type="text" required />
        </label>
        <label>
          City
          <input name="city" type="text" required />
        </label>
        <button type="submit" className="button">
          Create account
        </button>
      </form>
    </main>
  );
}
