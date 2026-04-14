import { Route, Router } from "@solidjs/router";
/* @refresh reload */
import { render } from "solid-js/web";

import "~/index.css";
import App from "~/App.tsx";
import { AnalysisScreen } from "~/screens/AnalysisScreen";
import { CoachScreen } from "~/screens/CoachScreen";
import { LanScreen } from "~/screens/LanScreen.tsx";
import { MenuScreen } from "~/screens/MenuScreen";

const root = document.getElementById("root");

// Rehydrate last route from localStorage
const ROUTE_STORAGE_KEY = "chess-coach:last-route";
let savedRoute = localStorage.getItem(ROUTE_STORAGE_KEY);
const base = "/chess";

// Fix corrupted routes with duplicate base prefixes (e.g. /chess/chess/chess/selena)
if (savedRoute) {
  while (savedRoute.startsWith(base + base)) {
    savedRoute = savedRoute.slice(base.length);
  }
  localStorage.setItem(ROUTE_STORAGE_KEY, savedRoute);
}

if (
  savedRoute &&
  savedRoute !== `${base}/` &&
  savedRoute !== base &&
  (window.location.pathname === `${base}/` || window.location.pathname === base)
) {
  window.history.replaceState(null, "", savedRoute);
}

render(
  () => (
    <Router base={base} root={App}>
      <Route path="/" component={MenuScreen} />
      <Route path="/selena" component={CoachScreen} />
      <Route path="/analysis" component={AnalysisScreen} />
      <Route path="/lan" component={LanScreen} />
    </Router>
  ),
  root!,
);
