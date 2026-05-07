import "./styles/global.css";

export default function App() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-addin-bg text-addin-fg font-mono">
      <div className="text-center space-y-4">
        <div className="text-5xl font-semibold tracking-tight">
          <span className="text-7xl">A</span>
          <span className="text-addin-fg-faint font-normal">/</span>
          addin
          <span className="align-super text-xs text-addin-fg-muted ml-1">2.0</span>
        </div>
        <div className="text-addin-fg-muted text-xs uppercase tracking-widest">
          local-first autonomous operator
        </div>
      </div>
    </main>
  );
}
