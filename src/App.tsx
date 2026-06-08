import { useEffect } from "react";
import { RouterProvider, useRouter, matchRoute } from "./lib/router";
import { AuthProvider } from "./lib/auth";
import { ThemeProvider } from "./lib/theme";
import { ToastProvider } from "./lib/toast";
import { I18nProvider } from "./lib/i18n";
import Layout from "./components/Layout";
import AIChat from "./components/AIChat";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import ProductDetail from "./pages/ProductDetail";
import Auth from "./pages/Auth";
import Library from "./pages/Library";
import Orders from "./pages/Orders";
import Profile from "./pages/Profile";
import Sell from "./pages/Sell";
import Admin from "./pages/Admin";
import Storefront from "./pages/Storefront";
import Notifications from "./pages/Notifications";
import StaticPage from "./pages/StaticPage";
import Payouts from "./pages/Payouts";
import Transactions from "./pages/Transactions";
import AccountSettings from "./pages/AccountSettings";
import Support from "./pages/Support";
import StoreDesigner from "./pages/StoreDesigner";
import AccessPage from "./pages/AccessPage";

function Routes() {
  const { path } = useRouter();

  useEffect(() => {
    // capture referral for affiliate (username = affiliate id) on any navigation
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) localStorage.setItem("bx_ref", ref);
  }, [path]);

  let page: React.ReactNode = <NotFound />;

  if (path === "/" || path === "") page = <Home />;
  else if (path === "/explore") page = <Explore />;
  else if (path === "/auth") page = <Auth />;
  else if (path === "/library") page = <Library />;
  else if (path === "/orders") page = <Orders />;
  else if (path === "/profile") page = <Profile />;
  else if (path === "/sell") page = <Sell />;
  else if (path === "/admin") page = <Admin />;
  else if (path === "/notifications") page = <Notifications />;
  else if (path === "/payouts") page = <Payouts />;
  else if (path === "/transactions") page = <Transactions />;
  else if (path === "/account") page = <AccountSettings />;
  else if (path === "/support") page = <Support />;
  else if (path === "/store-designer") page = <StoreDesigner />;
  else {
    const prod = matchRoute("/product/:id", path);
    const access = matchRoute("/access/:token", path);
    const pageM = matchRoute("/page/:slug", path);
    const storeProd = matchRoute("/:slug/:prod", path);
    const store = matchRoute("/:slug", path);
    if (prod) page = <ProductDetail id={prod.id} />;
    else if (access) page = <AccessPage token={access.token} />;
    else if (pageM) page = <StaticPage slug={pageM.slug} />;
    else if (storeProd && storeProd.slug.startsWith("@"))
      page = <ProductDetail username={storeProd.slug.slice(1)} slug={storeProd.prod} />;
    else if (store && store.slug.startsWith("@"))
      page = <Storefront username={store.slug.slice(1)} />;
  }

  return (
    <Layout>
      {page}
      <AIChat />
    </Layout>
  );
}

function NotFound() {
  const { navigate } = useRouter();
  return (
    <div className="py-24 text-center">
      <p className="text-6xl">🔍</p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
        Page not found
      </h1>
      <button
        onClick={() => navigate("/")}
        className="mt-4 rounded-xl bg-indigo-500 px-5 py-2.5 font-semibold text-white"
      >
        ← Back home
      </button>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <RouterProvider>
            <AuthProvider>
              <Routes />
            </AuthProvider>
          </RouterProvider>
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
