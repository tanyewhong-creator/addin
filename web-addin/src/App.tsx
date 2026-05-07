import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { PageShell } from "./ui/composites/PageShell";
import { TOP_LEVEL_ROUTES } from "./routes";
import "./styles/global.css";

function Brand() {
  return (
    <span className="font-mono font-semibold tracking-tight">
      <span className="text-base">A</span>
      <span className="text-addin-fg-faint font-normal">/</span>
      addin
      <span className="align-super text-[10px] text-addin-fg-muted ml-1">2.0</span>
    </span>
  );
}

function NavItems() {
  return (
    <>
      {TOP_LEVEL_ROUTES.map((r) => (
        <NavLink
          key={r.path}
          to={r.path}
          className={({ isActive }) =>
            [
              "px-3 h-11 inline-flex items-center text-xs",
              "border-b-2",
              isActive
                ? "text-addin-fg border-addin-line-strong font-medium"
                : "text-addin-fg-muted border-transparent hover:text-addin-fg",
            ].join(" ")
          }
        >
          {r.label}
        </NavLink>
      ))}
    </>
  );
}

function NavEnd() {
  return (
    <>
      <span className="border border-addin-line px-1.5 py-0.5 text-[10px]">⌘K</span>
    </>
  );
}

export default function App() {
  return (
    <PageShell topBar={{ brand: <Brand />, nav: <NavItems />, end: <NavEnd /> }}>
      <Routes>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        {TOP_LEVEL_ROUTES.map((r) => (
          <Route key={r.path} path={r.path} element={<r.component />} />
        ))}
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </PageShell>
  );
}
