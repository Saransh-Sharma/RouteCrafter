import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export function ComingSoon({
  eyebrow,
  title,
  subtitle,
  phase,
  bullets,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  phase: number;
  bullets: string[];
}) {
  return (
    <div className="space-y-8">
      <SectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <Card>
        <CardContent className="space-y-6 p-8">
          <div className="flex items-center gap-2">
            <Badge tone="gold">Phase {phase}</Badge>
            <span className="text-sm text-ink-muted">On the roadmap</span>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-2.5 rounded-2xl border border-border-soft bg-paper-2/40 px-4 py-3 text-sm text-ink-soft"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-terracotta" />
                {b}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
