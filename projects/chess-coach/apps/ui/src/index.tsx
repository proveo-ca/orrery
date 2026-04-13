/* @refresh reload */
import { render } from "solid-js/web";

import { Route, Router } from "@solidjs/router";

import "~/index.css";
import App from "~/App.tsx";
import { GameScreen } from "~/screens/GameScreen";
import { LanPlaceholder } from "~/screens/LanPlaceholder";
import { MenuScreen } from "~/screens/MenuScreen";

const root = document.getElementById("root");

// Rehydrate last route from localStorage
const ROUTE_STORAGE_KEY = "chess-coach:last-route";
const savedRoute = localStorage.getItem(ROUTE_STORAGE_KEY);
const base = "/chess";

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
      <Route path="/selena" component={GameScreen} />
      <Route path="/analysis" component={GameScreen} />
      <Route path="/lan" component={LanPlaceholder} />
    </Router>
  ),
  root!,
);
