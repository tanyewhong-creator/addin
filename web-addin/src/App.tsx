import "./styles/global.css";

export default function App() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white text-neutral-900 font-mono">
      <div className="text-center space-y-4">
        <div className="text-5xl font-semibold tracking-tight">
          <span className="text-7xl">A</span>
          <span className="text-neutral-400 font-normal">/</span>
          addin
          <span className="align-super text-xs text-neutral-500 ml-1">2.0</span>
        </div>
        <div className="text-neutral-500 text-xs uppercase tracking-widest">
          local-first autonomous operator
        </div>
        <div className="text-neutral-400 text-xs pt-4">
          web-addin scaffold — phase 1b
        </div>
      </div>
    </main>
  );
}
