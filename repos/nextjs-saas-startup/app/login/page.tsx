export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="card">
      <h1>Log in</h1>
      {error && <p className="error">Incorrect email or password.</p>}
      <form action="/api/auth/login" method="post" className="form">
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit" className="button">
          Log in
        </button>
      </form>
      <p className="muted">Demo account: demo@tablo.example / demo1234</p>
    </main>
  );
}
