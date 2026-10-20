import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container">
      <h1>Team scheduling for independent restaurants</h1>
      <p className="muted">
        Tablo helps restaurant managers plan shifts, share schedules with their team and stop
        juggling spreadsheets and group chats.
      </p>
      <p>
        <Link href="/signup" className="button">
          Start for free
        </Link>{" "}
        <Link href="/login" className="button button-secondary">
          Log in
        </Link>
      </p>
    </main>
  );
}
