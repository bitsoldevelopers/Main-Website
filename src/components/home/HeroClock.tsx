"use client";

import { useEffect, useState } from "react";

/** Local studio time, Pakistan Standard Time. Renders a placeholder on the server. */
export default function HeroClock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const format = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Karachi",
    });
    const tick = () => setTime(format.format(new Date()));
    const id = window.setInterval(tick, 15_000);
    const first = window.setTimeout(tick, 0);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, []);

  return (
    <span className="tabular-nums">
      PKT <span className="text-foreground">{time ?? "--:--"}</span>
    </span>
  );
}
