type InvokeMode = "cli" | "api" | "test";

let currentInvokeMode: InvokeMode = "cli";

export function setInvokeMode(mode: InvokeMode): void {
  currentInvokeMode = mode;
}

export function getInvokeMode(): InvokeMode {
  return currentInvokeMode;
}
