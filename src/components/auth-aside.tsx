import { WordTapestry } from "@/components/word-tapestry";

export function AuthAside() {
  return (
    <div className="auth-aside">
      <WordTapestry word="keenetix" rows={44} />
      <div className="tapestry-overlay">
        <p className="tapestry-caption">KEENETIX / <span>a kinetic tapestry of the network</span></p>
        <span className="tapestry-word">keenetix</span>
      </div>
    </div>
  );
}
