export type OpsState = "LIVE" | "SANDBOX" | "MOCK" | "NOT_READY" | "DEGRADED";

export function stateLabel(state: OpsState) {
  switch (state) {
    case "LIVE":
      return "LIVE";
    case "SANDBOX":
      return "SANDBOX";
    case "MOCK":
      return "MOCK";
    case "NOT_READY":
      return "NOT READY";
    case "DEGRADED":
      return "DEGRADED";
  }
}

export const UNAVAILABLE = "داده در دسترس نیست";
