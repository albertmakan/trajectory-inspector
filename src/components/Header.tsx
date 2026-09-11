import { useEffect, useRef } from "react";
import { Link, NavLink } from "react-router";
import { cx } from "../lib/cx";
import { ROUTES } from "../lib/routes";
import type { RunIndex } from "../lib/runs";
import {
  tabKey,
  tabLabel,
  tabPath,
  tabTitle,
  type OpenTab,
  type RunView,
} from "../lib/tabs";

const RUN_VIEWS: RunView[] = ["timeline", "graph"];

interface HeaderProps {
  index: RunIndex;
  /** Open runs and diffs, in the order they were opened. The run list tab always comes first. */
  tabs: OpenTab[];
  /** Key of the current route's tab, if the route has one. */
  activeKey: string | undefined;
  onClose: (tab: OpenTab) => void;
  project: string;
}

export function Header({
  index,
  tabs,
  activeKey,
  onClose,
  project,
}: HeaderProps) {
  const navRef = useRef<HTMLElement>(null);

  // Keep the active tab in view once the strip overflows.
  useEffect(() => {
    navRef.current
      ?.querySelector(".tab.is-active")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeKey]);

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand__mark" />
        <span className="brand__name">TRAJECTORY</span>
        <span className="brand__version">v0.9</span>
      </div>
      {/* `end` keeps it inactive on /runs/:id. */}
      <NavLink
        to={ROUTES.runs}
        end
        className={({ isActive }) => cx("tab", isActive && "is-active")}
      >
        RUN LIST
      </NavLink>
      <nav ref={navRef} className="tabs">
        {tabs.length > 0 && (
          <span className="tabs__divider" aria-hidden="true" />
        )}
        {tabs.map((tab) => {
          const key = tabKey(tab);
          const active = key === activeKey;
          const label = tabLabel(tab);
          return (
            <div
              key={key}
              className={cx("tab", "tab--open", active && "is-active")}
            >
              <Link
                to={tabPath(tab)}
                className="tab__link"
                title={tabTitle(tab, index)}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
              {active && tab.kind === "run" && (
                <span className="tab__views">
                  {RUN_VIEWS.map((view) => (
                    <Link
                      key={view}
                      to={tabPath({ ...tab, view })}
                      className={cx(
                        "tab__view",
                        tab.view === view && "is-active",
                      )}
                    >
                      {view}
                    </Link>
                  ))}
                </span>
              )}
              <button
                type="button"
                className="tab__close"
                aria-label={`Close ${label}`}
                onClick={() => onClose(tab)}
              >
                ✕
              </button>
            </div>
          );
        })}
      </nav>
      <div className="spacer" />
      {project && <span className="topbar__meta">{project}</span>}
    </header>
  );
}
