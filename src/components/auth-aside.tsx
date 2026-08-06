import { AsciiField } from "@/components/ascii-field";
import { KeenetixLogo } from "@/components/keenetix-logo";

export function AuthAside() {
  return (
    <div className="auth-aside">
      <AsciiField rows={30} cols={42} variant="drift" className="auth-grid" />
      <div className="auth-mark"><KeenetixLogo compact dark /></div>
      <p>KEENETIX / SECURING THE MACHINE ECONOMY</p>
    </div>
  );
}
