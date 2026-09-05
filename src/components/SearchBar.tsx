import type { FormEvent, RefObject } from "react";
import { useState } from "react";
import { ArrowIcon, SearchIcon } from "./icons";

export interface RoutingState {
  label: string;
  stage: string;
}

interface Props {
  engineLabel: string;
  routing: RoutingState | null;
  onRoute: (raw: string) => void;
  onEngineClick: () => void;
  inputRef: RefObject<HTMLInputElement>;
}

export default function SearchBar({ engineLabel, routing, onRoute, onEngineClick, inputRef }: Props) {
  const [value, setValue] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim() || routing) return;
    onRoute(value);
  };

  return (
    <div className="sd-search-wrap">
      <form className="sd-search" onSubmit={submit} role="search">
        <span className="sd-search-icon">
          <SearchIcon size={19} />
        </span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search the web or paste a URL…"
          aria-label="Search or URL to route through the proxy"
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="button"
          className="sd-engine-chip"
          onClick={onEngineClick}
          title="Change proxy engine"
          aria-label={`Proxy engine: ${engineLabel}. Open settings`}
        >
          <span className="pulse" aria-hidden />
          {engineLabel}
        </button>
        <button className="sd-go-btn" type="submit" disabled={!!routing} aria-label="Route request">
          {routing ? (
            <span
              className="spinner"
              style={{ width: 16, height: 16, borderColor: "rgba(23, 10, 5, 0.35)", borderTopColor: "#170a05" }}
              aria-hidden
            />
          ) : (
            <ArrowIcon size={18} />
          )}
        </button>
      </form>

      <div className={`sd-route-status${routing ? " is-on" : ""}`} aria-live="polite">
        {routing && (
          <>
            <span className="spinner" aria-hidden />
            <span>
              {routing.label} — {routing.stage}…
            </span>
          </>
        )}
      </div>
    </div>
  );
}
