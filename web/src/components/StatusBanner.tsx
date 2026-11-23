import { useSession } from "../lib/session";
import { useSettings } from "../lib/settings";

export function StatusBanner() {
  const { settings } = useSettings();
  const { unlocked, address } = useSession();

  let text: string;
  if (settings.mode === "fixture") {
    text =
      "Reference client. Fixture mode: reads are fixture-backed. Switch to live in Network settings.";
  } else if (!unlocked) {
    text = `Live mode: ${settings.nodeUrl}. Wallet locked; reads work, writes require unlock. Devnet only.`;
  } else {
    text = `Live mode: ${settings.nodeUrl}. Wallet ${address ?? ""} unlocked. Writes require finality. Devnet only.`;
  }

  return (
    <div
      className="status-banner"
      role="status"
      data-mode={settings.mode}
      data-unlocked={String(unlocked)}
    >
      {text}
    </div>
  );
}
