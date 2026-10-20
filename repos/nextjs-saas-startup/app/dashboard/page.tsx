import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { countUsersInRestaurant, findRestaurantById } from "@/lib/db";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurant = await findRestaurantById(user.restaurantId);
  const teamSize = await countUsersInRestaurant(user.restaurantId);

  return (
    <main className="container">
      <h1>Welcome, {user.name}</h1>
      <p className="muted">
        {restaurant ? `${restaurant.name} · ${restaurant.city}` : "No restaurant linked"}
      </p>

      <section className="stats">
        <div className="stat">
          <div className="muted">Team members</div>
          <div className="stat-value">{teamSize}</div>
        </div>
        <div className="stat">
          <div className="muted">Shifts this week</div>
          <div className="stat-value">0</div>
        </div>
      </section>

      <form action="/api/auth/logout" method="post" style={{ marginTop: "2rem" }}>
        <button type="submit" className="button button-secondary">
          Log out
        </button>
      </form>
    </main>
  );
}
