import { Link, NavLink, Outlet } from "react-router-dom";
import { StatusBanner } from "./StatusBanner";

const links: Array<[string, string]> = [
  ["/", "Home"],
  ["/network", "Network"],
  ["/keystore", "Keystore"],
  ["/deploy", "Deploy"],
];

export function Layout() {
  return (
    <div className="app">
      <header className="masthead">
        <Link to="/" className="brand">
          <strong>r-print</strong>
          <span>reference client</span>
        </Link>
        <nav>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <StatusBanner />
      <main>
        <Outlet />
      </main>
      <footer>
        <span>Devnet only. Opt-in live mode. No indexer.</span>
        <a href="https://github.com/rhovision-org/r-print">source</a>
      </footer>
    </div>
  );
}
