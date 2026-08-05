"use client";
import { FormEvent, useEffect, useState } from "react";
type Member = { id: number; userId: number; name: string; email: string; role: string; createdAt: string };
export function WorkspaceTeam({ role }: { role: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const canManage = role === "owner" || role === "admin";
  const load = async () => {
    const response = await fetch("/api/workspace/members");
    const data = await response.json() as { members?: Member[]; error?: string };
    if (response.ok) setMembers(data.members ?? []); else setError(data.error ?? "Unable to load team.");
    setLoading(false);
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount
  useEffect(() => { void load(); }, []);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/workspace/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), role: form.get("role") }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) setError(data.error ?? "Unable to update member.");
    else { setMessage("Team member role saved."); event.currentTarget.reset(); await load(); }
  };
  return <section className="team-panel"><div className="team-intro"><p className="section-label">Workspace team</p><h2>People, roles,<br /><em>clear authority.</em></h2><p>Roles scope dashboard actions and credentials: owners and admins manage access, builders create economic work, and viewers can inspect it.</p></div><div className="team-card"><div className="team-card-head"><div><p>MEMBERS</p><h3>{loading ? "Loading team…" : `${members.length} workspace members`}</h3></div><span className={`role-chip role-${role}`}>{role}</span></div><div className="member-list">{members.map((member) => <article key={member.id}><span>{member.name.slice(0, 1)}</span><div><b>{member.name}</b><small>{member.email}</small></div><em>{member.role}</em></article>)}</div>{canManage && <form className="member-form" onSubmit={submit}><label>Existing account email<input name="email" type="email" required placeholder="teammate@company.com" /></label><label>Workspace role<select name="role" defaultValue="builder"><option value="admin">Admin</option><option value="builder">Builder</option><option value="member">Member</option><option value="viewer">Viewer</option></select></label><button className="button button-coral">Add or update member</button></form>}{message && <p className="team-message">{message}</p>}{error && <p className="form-error">{error}</p>}</div></section>;
}
