import { ComingSoon } from "@/components/layout/ComingSoon";

export default function SettingsPage() {
  return (
    <ComingSoon
      eyebrow="Settings"
      title="Studio & brand settings"
      subtitle="Set your brand voice and defaults, manage export preferences, and optionally connect an AI model to generate inside the app."
      phase={12}
      bullets={[
        "Brand settings (name, voice, footer/disclaimer)",
        "Default generation style",
        "Default deliverables",
        "Export preferences",
        "Optional AI provider & API key",
        "Prompt-output mode always available as fallback",
      ]}
    />
  );
}
