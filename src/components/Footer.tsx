interface Props {
  greeting: string;
  ping: number;
  pingOk: boolean;
  clock: string;
  panicEnabled: boolean;
  onPanic: () => void;
  /** Route a URL through the in-page browser (no tabs, ever). */
  onBrowse: (url: string) => void;
}

export default function Footer({ greeting, ping, pingOk, clock, panicEnabled, onPanic, onBrowse }: Props) {
  return (
    <footer className="sd-footer">
      <div className="sd-greet">
        <span>
          {greeting}, <strong>User</strong>!
        </span>
        <span className="wave" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11m0-5.5v-1a1.5 1.5 0 0 1 3 0V11m0-4.5a1.5 1.5 0 0 1 3 0V13" />
            <path d="M16 13V9.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1c-3 0-5-1.5-6.5-4L2.6 13.7a1.6 1.6 0 0 1 2.5-2L7 13.5" />
          </svg>
        </span>
      </div>

      <div className="sd-telemetry" role="status" aria-live="off">
        <span className="sd-ping">
          <span className={`dot${pingOk ? "" : " is-warn"}`} aria-hidden />
          Ping: <b>{ping} ms</b>
        </span>
        <span className="sd-node">node · us-east-1</span>
        <span className="sd-clock">{clock}</span>
        {panicEnabled && (
          <button className="sd-panic-chip" onClick={onPanic} title="Bail out now">
            <kbd>~</kbd> panic
          </button>
        )}
      </div>

      <div className="sd-links">
        <button onClick={() => onBrowse("https://github.com/titaniumnetwork-dev/Ultraviolet")} title="Open in the in-page browser">
          ultraviolet
        </button>
        <span className="sep" aria-hidden>/</span>
        <button onClick={() => onBrowse("https://github.com/MercuryWorkshop/bare-mux")} title="Open in the in-page browser">
          bare-mux
        </button>
        <span className="sep" aria-hidden>/</span>
        <button onClick={() => onBrowse("https://github.com/HomemadeGameStudio/lessons-moved-")} title="Open in the in-page browser">
          ports
        </button>
      </div>
    </footer>
  );
}
